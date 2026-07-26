import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ExerciseContext as ExerciseContextType } from '../models/types';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Props for the {@link ExerciseContextPanel} component.
 */
export interface ExerciseContextProps {
  /** The current exercise context configuration */
  exerciseContext: ExerciseContextType;
  /** Callback fired whenever any context field is modified */
  onUpdate: (context: ExerciseContextType) => void;
}

/**
 * ExerciseContextPanel allows students to attach problem statements or textbook photos.
 *
 * Providing problem statements helps Gemini verify proofs against exact premises,
 * target definitions, and theorem constraints.
 */
export const ExerciseContextPanel: React.FC<ExerciseContextProps> = ({
  exerciseContext,
  onUpdate,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTextInput, setShowTextInput] = useState(Boolean(exerciseContext.sourceText));

  /**
   * Toggles collapsible drawer with animated height transition.
   */
  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((prev) => !prev);
  };

  /**
   * Updates reference text (e.g. 'Exercise 4.2b')
   */
  const handleReferenceChange = (text: string) => {
    onUpdate({
      ...exerciseContext,
      reference: text,
    });
  };

  /**
   * Updates problem statement typed text
   */
  const handleSourceTextChange = (text: string) => {
    onUpdate({
      ...exerciseContext,
      sourceText: text,
    });
  };

  /**
   * Captures exercise photo using camera
   */
  const handleTakePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          'Camera Access Required',
          'ProofPal requires camera access to photograph exercise pages.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        onUpdate({
          ...exerciseContext,
          sourceImageUri: result.assets[0].uri,
        });
      }
    } catch (err) {
      console.error('Camera error:', err);
      Alert.alert('Error', 'Failed to launch camera.');
    }
  };

  /**
   * Picks exercise photo from photo library
   */
  const handlePickFile = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          'Library Permission Required',
          'Photo library access is required to select exercise images.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        onUpdate({
          ...exerciseContext,
          sourceImageUri: result.assets[0].uri,
        });
      }
    } catch (err) {
      console.error('Picker error:', err);
      Alert.alert('Error', 'Failed to select image from library.');
    }
  };

  /**
   * Removes attached exercise photo
   */
  const handleRemoveImage = () => {
    onUpdate({
      ...exerciseContext,
      sourceImageUri: undefined,
    });
  };

  // Determine if any context data has been filled by user
  const hasContent = Boolean(
    exerciseContext.reference || exerciseContext.sourceText || exerciseContext.sourceImageUri
  );

  return (
    <View style={styles.cardContainer}>
      {/* Collapsible Panel Header */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={toggleExpand}
        style={styles.headerRow}
        accessibilityRole="button"
        accessibilityLabel="Exercise Context Panel"
      >
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>📝 Exercise Context (optional)</Text>
          {hasContent && <View style={styles.activeDot} />}
        </View>
        <Text style={styles.expandChevron}>{isExpanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {/* Expanded Content Area */}
      {isExpanded && (
        <View style={styles.bodyContent}>
          {/* Section 1: Exercise Reference */}
          <View style={styles.fieldSection}>
            <Text style={styles.fieldLabel}>Exercise Reference</Text>
            <TextInput
              style={styles.textInput}
              value={exerciseContext.reference || ''}
              onChangeText={handleReferenceChange}
              placeholder="e.g., Exercise 4.2b, Spivak Ch. 5 #12"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          {/* Section 2: Source Material Attachment Options */}
          <View style={styles.fieldSection}>
            <Text style={styles.fieldLabel}>Source Material</Text>
            <View style={styles.sourceButtonRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setShowTextInput((prev) => !prev);
                }}
                style={[
                  styles.sourceButton,
                  showTextInput && styles.sourceButtonActive,
                ]}
              >
                <Text style={styles.sourceButtonText}>📝 Type Statement</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleTakePhoto}
                style={styles.sourceButton}
              >
                <Text style={styles.sourceButtonText}>📷 Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handlePickFile}
                style={styles.sourceButton}
              >
                <Text style={styles.sourceButtonText}>📁 File</Text>
              </TouchableOpacity>
            </View>

            {/* Typed Exercise Statement Input */}
            {showTextInput && (
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                value={exerciseContext.sourceText || ''}
                onChangeText={handleSourceTextChange}
                placeholder="Type or paste the full problem statement here..."
                placeholderTextColor={COLORS.textMuted}
                multiline={true}
                numberOfLines={3}
                textAlignVertical="top"
              />
            )}
          </View>

          {/* Section 3: Source Image Preview */}
          {exerciseContext.sourceImageUri && (
            <View style={styles.imagePreviewWrapper}>
              <Text style={styles.fieldLabel}>Attached Exercise Image</Text>
              <View style={styles.imageCard}>
                <Image
                  source={{ uri: exerciseContext.sourceImageUri }}
                  style={styles.sourceImage}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleRemoveImage}
                  style={styles.removeImageButton}
                  accessibilityLabel="Remove attached exercise photo"
                >
                  <Text style={styles.removeImageText}>✕ Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: SPACING.xs,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs + 2,
  },
  headerTitle: {
    fontSize: FONT_SIZES.sm + 1,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.accent,
  },
  expandChevron: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  bodyContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    gap: SPACING.md,
  },
  fieldSection: {
    marginTop: SPACING.sm,
  },
  fieldLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  multilineInput: {
    minHeight: 80,
    marginTop: SPACING.xs,
  },
  sourceButtonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  sourceButton: {
    flex: 1,
    backgroundColor: COLORS.bgSurface,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sourceButtonActive: {
    borderColor: COLORS.primaryLight,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  sourceButtonText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xs + 1,
    fontWeight: '600',
  },
  imagePreviewWrapper: {
    marginTop: SPACING.xs,
  },
  imageCard: {
    height: 120,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  sourceImage: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  removeImageText: {
    color: '#ffffff',
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
});

export default ExerciseContextPanel;
