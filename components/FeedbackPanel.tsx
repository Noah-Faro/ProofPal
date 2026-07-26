import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  ViewStyle,
} from 'react-native';
import { ProofCheckResult } from '../models/types';
import { getModelInfo } from '../models/geminiModels';
import { getDepthInfo } from '../models/depthLevels';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import LatexRenderer from './LatexRenderer';

export interface FeedbackPanelProps {
  /** The AI response result */
  result?: ProofCheckResult | null;
  /** True while waiting for API response */
  isLoading: boolean;
  /** Error message if the API call failed */
  error?: string | null;
  /** Optional custom container style */
  style?: ViewStyle;
}

/**
 * FeedbackPanel displays the AI's proof check results, loading shimmer states,
 * error messages, or empty state prompts in a dark-themed card layout.
 */
export const FeedbackPanel: React.FC<FeedbackPanelProps> = ({
  result,
  isLoading,
  error,
  style,
}) => {
  // Pulsing animation for loading shimmer state
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const [dots, setDots] = useState<string>('');

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isLoading) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.8,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();

      interval = setInterval(() => {
        setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
      }, 400);
    } else {
      pulseAnim.setValue(0.3);
      setDots('');
    }

    return () => {
      if (animation) {
        animation.stop();
      }
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isLoading, pulseAnim]);

  // Render 1: Loading State
  if (isLoading) {
    return (
      <View style={[styles.card, styles.loadingCard, style]}>
        <View style={styles.loadingHeader}>
          <Animated.View style={[styles.loadingPulseDot, { opacity: pulseAnim }]} />
          <Text style={styles.loadingTitle}>Checking your proof{dots}</Text>
        </View>
        <View style={styles.skeletonContainer}>
          <Animated.View
            style={[styles.skeletonLine, { width: '92%', opacity: pulseAnim }]}
          />
          <Animated.View
            style={[styles.skeletonLine, { width: '78%', opacity: pulseAnim }]}
          />
          <Animated.View
            style={[styles.skeletonLine, { width: '85%', opacity: pulseAnim }]}
          />
          <Animated.View
            style={[styles.skeletonLine, { width: '60%', opacity: pulseAnim }]}
          />
          <Animated.View
            style={[styles.skeletonLine, { width: '40%', opacity: pulseAnim }]}
          />
        </View>
      </View>
    );
  }

  // Render 2: Error State
  if (error) {
    return (
      <View style={[styles.card, styles.errorCard, style]}>
        <View style={styles.errorHeader}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Proof Check Error</Text>
        </View>
        <Text style={styles.errorMessage}>{error}</Text>
      </View>
    );
  }

  // Render 3: Result State
  if (result) {
    const modelInfo = getModelInfo(result.model);
    const depthInfo = getDepthInfo(result.depth);
    const formattedTime = result.timestamp
      ? new Date(result.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    return (
      <View style={[styles.card, style]}>
        <View style={styles.header}>
          <View style={styles.headerBadges}>
            {modelInfo && (
              <View style={styles.modelBadge}>
                <Text style={styles.modelBadgeText}>{modelInfo.badge}</Text>
              </View>
            )}
            {depthInfo && (
              <View
                style={[
                  styles.depthBadge,
                  {
                    borderColor: depthInfo.color + '66',
                    backgroundColor: depthInfo.color + '1A',
                  },
                ]}
              >
                <Text style={styles.depthBadgeIcon}>{depthInfo.icon}</Text>
                <Text
                  style={[styles.depthBadgeText, { color: depthInfo.color }]}
                >
                  {depthInfo.label}
                </Text>
              </View>
            )}
            {result.isCorrect !== undefined && (
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: result.isCorrect
                      ? 'rgba(34, 197, 94, 0.15)'
                      : 'rgba(239, 68, 68, 0.15)',
                    borderColor: result.isCorrect
                      ? COLORS.success
                      : COLORS.error,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    {
                      color: result.isCorrect
                        ? COLORS.success
                        : COLORS.error,
                    },
                  ]}
                >
                  {result.isCorrect ? '✓ Correct' : '✕ Needs Revision'}
                </Text>
              </View>
            )}
          </View>
          {formattedTime ? (
            <Text style={styles.timestampText}>{formattedTime}</Text>
          ) : null}
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          <LatexRenderer content={result.response} />
        </ScrollView>
      </View>
    );
  }

  // Render 4: Empty State
  return (
    <View style={[styles.card, styles.emptyCard, style]}>
      <Text style={styles.emptyIcon}>📐</Text>
      <Text style={styles.emptyTitle}>
        Drop a proof image and tap Check to get feedback
      </Text>
      <Text style={styles.emptySubtitle}>
        ProofPal AI will analyze your mathematical steps and provide tailored guidance.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: SPACING.md,
    overflow: 'hidden',
  },
  // Loading State Styles
  loadingCard: {
    justifyContent: 'flex-start',
  },
  loadingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  loadingPulseDot: {
    width: 10,
    height: 10,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryLight,
  },
  loadingTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.primaryLight,
  },
  skeletonContainer: {
    gap: SPACING.md,
  },
  skeletonLine: {
    height: 16,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.bgSurface,
  },
  // Error State Styles
  errorCard: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    justifyContent: 'center',
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  errorIcon: {
    fontSize: FONT_SIZES.lg,
  },
  errorTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.error,
  },
  errorMessage: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  // Result State Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: SPACING.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: SPACING.sm,
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  modelBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 2,
  },
  modelBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.primaryLight,
  },
  depthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 2,
    gap: 4,
  },
  depthBadgeIcon: {
    fontSize: FONT_SIZES.xs,
  },
  depthBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 2,
  },
  statusBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  timestampText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: SPACING.xs,
  },
  // Empty State Styles
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.md,
    opacity: 0.7,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  emptySubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    maxWidth: 360,
  },
});

export default FeedbackPanel;
