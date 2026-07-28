import React from 'react';
import { View, Text, StyleSheet, ScrollView, type ViewStyle } from 'react-native';
import type { ProofCheckResult, ProofCheckStage, ProofVerdict } from '../types/proof';
import { getModelInfo } from '../models/geminiModels';
import { getDepthInfo } from '../models/depthLevels';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import { MarkdownRenderer } from './MarkdownRenderer';

export interface FeedbackPanelProps {
  result?: ProofCheckResult | null;
  isLoading: boolean;
  stage?: ProofCheckStage;
  style?: ViewStyle;
}

export const FeedbackPanel: React.FC<FeedbackPanelProps> = ({ result, isLoading, stage, style }) => {
  if (isLoading) {
    return (
      <View style={[styles.card, styles.loadingCard, style]} accessibilityLiveRegion="polite">
        <View style={styles.loadingHeader}>
          <View style={styles.loadingPulseDot} />
          <Text style={styles.loadingTitle}>{stageLabel(stage)}</Text>
        </View>
        <View style={styles.skeletonContainer}>
          {(['92%', '78%', '85%', '60%', '40%'] as `${number}%`[]).map((width) => <View key={width} style={[styles.skeletonLine, { width }]} />)}
        </View>
      </View>
    );
  }

  if (result) {
    const modelInfo = getModelInfo(result.model);
    const depthInfo = getDepthInfo(result.depth);
    const formattedTime = new Date(result.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return (
      <View style={[styles.card, style]}>
        <View style={styles.header}>
          <View style={styles.headerBadges}>
            {modelInfo && <View style={styles.modelBadge}><Text style={styles.modelBadgeText}>{modelInfo.badge}</Text></View>}
            {depthInfo && <View style={[styles.depthBadge, { borderColor: `${depthInfo.color}66`, backgroundColor: `${depthInfo.color}1A` }]}><Text style={[styles.depthBadgeText, { color: depthInfo.color }]}>{depthInfo.label}</Text></View>}
            <VerdictBadge verdict={result.verdict} />
          </View>
          <Text style={styles.timestampText}>{formattedTime}</Text>
        </View>
        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator>
          <MarkdownRenderer content={result.feedbackMarkdown} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.emptyCard, style]}>
      <Text style={styles.emptyTitle}>Drop a proof image and tap Check to get feedback</Text>
      <Text style={styles.emptySubtitle}>Scribe will analyse your mathematical steps and provide tailored guidance.</Text>
    </View>
  );
};

const VERDICT_COPY: Record<ProofVerdict, { label: string; color: string; background: string }> = {
  correct: { label: 'Correct', color: COLORS.success, background: 'rgba(34, 197, 94, 0.15)' },
  incorrect: { label: 'Needs revision', color: COLORS.error, background: 'rgba(239, 68, 68, 0.15)' },
  incomplete: { label: 'Incomplete', color: COLORS.accent, background: 'rgba(245, 158, 11, 0.15)' },
  unreadable: { label: 'Unreadable', color: COLORS.textSecondary, background: COLORS.bgSurface },
};

function VerdictBadge({ verdict }: { verdict: ProofVerdict }) {
  const copy = VERDICT_COPY[verdict];
  return <View style={[styles.statusBadge, { backgroundColor: copy.background, borderColor: copy.color }]} accessibilityLabel={`Verdict: ${copy.label}`}><Text style={[styles.statusBadgeText, { color: copy.color }]}>{copy.label}</Text></View>;
}

function stageLabel(stage: ProofCheckStage | undefined): string {
  switch (stage) {
    case 'preparing': return 'Preparing your proof';
    case 'uploading-pdf': return 'Uploading course PDF';
    case 'processing-pdf': return 'Processing course PDF';
    default: return 'Checking your proof';
  }
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', padding: SPACING.md, overflow: 'hidden' },
  loadingCard: { justifyContent: 'flex-start' },
  loadingHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg, gap: SPACING.sm },
  loadingPulseDot: { width: 10, height: 10, borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.primaryLight },
  loadingTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.primaryLight },
  skeletonContainer: { gap: SPACING.md },
  skeletonLine: { height: 16, borderRadius: BORDER_RADIUS.sm, backgroundColor: COLORS.bgSurface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: SPACING.sm + 4, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.08)', marginBottom: SPACING.sm },
  headerBadges: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACING.sm },
  modelBadge: { backgroundColor: 'rgba(99, 102, 241, 0.15)', borderWidth: 1, borderColor: 'rgba(129, 140, 248, 0.3)', borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.sm + 2, paddingVertical: 2 },
  modelBadgeText: { fontSize: FONT_SIZES.xs, fontWeight: '600', color: COLORS.primaryLight },
  depthBadge: { borderWidth: 1, borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.sm + 2, paddingVertical: 2 },
  depthBadgeText: { fontSize: FONT_SIZES.xs, fontWeight: '600' },
  statusBadge: { borderWidth: 1, borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.sm + 2, paddingVertical: 2 },
  statusBadgeText: { fontSize: FONT_SIZES.xs, fontWeight: '700' },
  timestampText: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, marginLeft: SPACING.sm },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingVertical: SPACING.xs },
  emptyCard: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xxl },
  emptyTitle: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.textPrimary, textAlign: 'center', marginBottom: SPACING.xs },
  emptySubtitle: { fontSize: FONT_SIZES.sm, color: COLORS.textMuted, textAlign: 'center', maxWidth: 360 },
});

export default FeedbackPanel;
