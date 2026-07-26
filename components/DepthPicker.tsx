import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { DEPTH_LEVELS } from '../models/depthLevels';
import { PedagogicalDepth } from '../models/types';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

export interface DepthPickerProps {
  selectedDepth: PedagogicalDepth;
  onDepthChange: (depth: PedagogicalDepth) => void;
  disabled?: boolean;
}

/** A compact, touch-friendly five-level segmented control for iPad split view. */
export const DepthPicker: React.FC<DepthPickerProps> = ({
  selectedDepth,
  onDepthChange,
  disabled = false,
}) => {
  const { width } = useWindowDimensions();
  const compact = width < 520;
  const selectedInfo = DEPTH_LEVELS.find((item) => item.level === selectedDepth) ?? DEPTH_LEVELS[0];

  return (
    <View style={styles.container}>
      <Text style={styles.headerLabel}>HELP LEVEL</Text>
      <View style={styles.segmentedControl} accessibilityRole="radiogroup">
        {DEPTH_LEVELS.map((item) => {
          const isSelected = item.level === selectedDepth;
          const activeColor = item.color || COLORS.primary;
          return (
            <TouchableOpacity
              key={item.level}
              activeOpacity={0.75}
              disabled={disabled}
              onPress={() => onDepthChange(item.level)}
              style={[
                styles.segment,
                isSelected
                  ? [styles.segmentSelected, { backgroundColor: activeColor }]
                  : styles.segmentUnselected,
                disabled && styles.disabled,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, disabled }}
              accessibilityLabel={`${item.label} help level`}
            >
              {!compact && <Text style={styles.segmentIcon}>{item.icon}</Text>}
              <Text
                style={[
                  styles.segmentLabel,
                  compact && styles.segmentLabelCompact,
                  isSelected ? styles.segmentLabelSelected : styles.segmentLabelUnselected,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.descriptionCard, { borderColor: selectedInfo.color }]}>
        <View style={[styles.badgeDot, { backgroundColor: selectedInfo.color }]} />
        <Text style={styles.descriptionText}>
          <Text style={styles.descriptionHighlight}>{selectedInfo.label}: </Text>
          {selectedInfo.description}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%', marginVertical: SPACING.sm },
  headerLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.2,
    marginBottom: SPACING.xs,
  },
  segmentedControl: {
    flexDirection: 'row',
    width: '100%',
    minHeight: 52,
    padding: 4,
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  segment: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderRadius: BORDER_RADIUS.md,
    gap: 3,
  },
  segmentSelected: { elevation: 2 },
  segmentUnselected: { backgroundColor: COLORS.bgSurface },
  segmentIcon: { fontSize: FONT_SIZES.sm },
  segmentLabel: { fontSize: FONT_SIZES.xs, fontWeight: '600', textAlign: 'center' },
  segmentLabelCompact: { fontSize: 11 },
  segmentLabelSelected: { color: '#ffffff', fontWeight: '700' },
  segmentLabelUnselected: { color: COLORS.textSecondary },
  disabled: { opacity: 0.45 },
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
  badgeDot: { width: 8, height: 8, borderRadius: BORDER_RADIUS.full },
  descriptionText: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, lineHeight: 19 },
  descriptionHighlight: { color: COLORS.textPrimary, fontWeight: '700' },
});

export default DepthPicker;
