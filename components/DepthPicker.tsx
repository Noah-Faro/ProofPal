import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { DEPTH_LEVELS } from '../models/depthLevels';
import { PedagogicalDepth } from '../models/types';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

/**
 * Props for the {@link DepthPicker} component.
 */
export interface DepthPickerProps {
  /** The currently active pedagogical depth level */
  selectedDepth: PedagogicalDepth;
  /** Callback fired when the user selects a new depth level */
  onDepthChange: (depth: PedagogicalDepth) => void;
}

/**
 * DepthPicker renders a horizontal segmented control displaying the 5 pedagogical depth levels.
 *
 * Each level allows the student to customize how much assistance the AI provides,
 * ranging from basic verification (Explore) to full solution walkthroughs (Solve).
 */
export const DepthPicker: React.FC<DepthPickerProps> = ({
  selectedDepth,
  onDepthChange,
}) => {
  // Find metadata for currently selected depth
  const selectedInfo = DEPTH_LEVELS.find((d) => d.level === selectedDepth) || DEPTH_LEVELS[0];

  return (
    <View style={styles.container}>
      <Text style={styles.headerLabel}>HELP LEVEL</Text>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.segmentedControl}>
          {DEPTH_LEVELS.map((item) => {
            const isSelected = item.level === selectedDepth;
            const activeColor = item.color || COLORS.primary;

            return (
              <TouchableOpacity
                key={item.level}
                activeOpacity={0.8}
                onPress={() => onDepthChange(item.level)}
                style={[
                  styles.segment,
                  isSelected
                    ? [styles.segmentSelected, { backgroundColor: activeColor }]
                    : styles.segmentUnselected,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${item.label} depth level`}
              >
                <Text style={styles.segmentIcon}>{item.icon}</Text>
                <Text
                  style={[
                    styles.segmentLabel,
                    isSelected ? styles.segmentLabelSelected : styles.segmentLabelUnselected,
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Selected Depth Description Callout */}
      {selectedInfo && (
        <View style={[styles.descriptionCard, { borderColor: selectedInfo.color }]}>
          <View style={[styles.badgeDot, { backgroundColor: selectedInfo.color }]} />
          <Text style={styles.descriptionText}>
            <Text style={styles.descriptionHighlight}>{selectedInfo.icon} {selectedInfo.label}: </Text>
            {selectedInfo.description}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: SPACING.sm,
  },
  headerLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.2,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
  },
  scrollContent: {
    paddingVertical: SPACING.xs,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xs,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs + 2,
    minWidth: 105,
  },
  segmentSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  segmentUnselected: {
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  segmentIcon: {
    fontSize: FONT_SIZES.md,
  },
  segmentLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  segmentLabelSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  segmentLabelUnselected: {
    color: COLORS.textSecondary,
  },
  descriptionCard: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: BORDER_RADIUS.full,
  },
  descriptionText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: FONT_SIZES.sm * 1.4,
  },
  descriptionHighlight: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
});

export default DepthPicker;
