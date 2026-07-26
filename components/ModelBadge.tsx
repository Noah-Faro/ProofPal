import React from 'react';
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  View,
} from 'react-native';
import { getModelInfo } from '../models/geminiModels';
import { GeminiModel } from '../models/types';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

/**
 * Props for the {@link ModelBadge} component.
 */
export interface ModelBadgeProps {
  /** The currently active Gemini model */
  model: GeminiModel;
  /** Optional callback fired when pressing the badge (e.g., to open model selection modal) */
  onPress?: () => void;
}

/**
 * ModelBadge is a compact pill component displaying the currently active Gemini model version.
 *
 * Placed in top navigation or headers to inform the student which model is running.
 */
export const ModelBadge: React.FC<ModelBadgeProps> = ({
  model,
  onPress,
}) => {
  const modelInfo = getModelInfo(model);
  const badgeText = modelInfo?.badge || model;

  const content = (
    <View style={styles.badgeContainer}>
      <View style={styles.liveIndicator} />
      <Text style={styles.badgeText}>{badgeText}</Text>
      {onPress && <Text style={styles.chevron}>⚙️</Text>}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={styles.touchableWrapper}
        accessibilityRole="button"
        accessibilityLabel={`Active model: ${modelInfo?.label || model}. Tap to change settings.`}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={styles.touchableWrapper}>{content}</View>;
};

const styles = StyleSheet.create({
  touchableWrapper: {
    alignSelf: 'flex-start',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    gap: SPACING.xs,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.success,
  },
  badgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.primaryLight,
    letterSpacing: 0.3,
  },
  chevron: {
    fontSize: 10,
    marginLeft: 2,
  },
});

export default ModelBadge;
