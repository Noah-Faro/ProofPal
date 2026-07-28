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
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { LocalAttachment, ProofExerciseContext } from '../types/proof';
import type { LibraryBook } from '../utilities/libraryStorage';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

const MAX_PDF_BYTES = 50 * 1024 * 1024;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface ExerciseContextProps {
  exerciseContext: ProofExerciseContext;
  onUpdate: (context: ProofExerciseContext) => void;
  disabled?: boolean;
  availableBooks?: LibraryBook[];
  selectedBookId?: string;
  onSelectBook?: (bookId: string | undefined) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

function imageAttachment(asset: ImagePicker.ImagePickerAsset): LocalAttachment {
  return {
    uri: asset.uri,
    name: asset.fileName ?? 'exercise-image',
    mimeType: asset.mimeType ?? '',
    size: asset.fileSize ?? undefined,
  };
}

export const ExerciseContextPanel: React.FC<ExerciseContextProps> = ({
  exerciseContext,
  onUpdate,
  disabled = false,
  availableBooks,
  selectedBookId,
  onSelectBook,
  onFocus,
  onBlur,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTextInput, setShowTextInput] = useState(Boolean(exerciseContext.sourceText));

  const update = (next: ProofExerciseContext) => {
    if (!disabled) onUpdate(next);
  };

  const pickExerciseImage = async (source: 'camera' | 'library') => {
    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', `Allow ${source === 'camera' ? 'camera' : 'photo library'} access to attach an exercise image.`);
        return;
      }

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.9,
          });
      if (!result.canceled && result.assets[0]) {
        update({ ...exerciseContext, sourceImage: imageAttachment(result.assets[0]) });
      }
    } catch {
      Alert.alert('Image unavailable', 'Scribe could not attach that image. Please try again.');
    }
  };

  const pickCoursePdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const looksLikePdf = asset.name.toLowerCase().endsWith('.pdf');
      if (asset.mimeType !== 'application/pdf' && !(asset.mimeType === undefined && looksLikePdf)) {
        Alert.alert('PDF required', 'Choose a PDF course document. EPUB and other file formats are not supported.');
        return;
      }
      if (asset.size !== undefined && asset.size > MAX_PDF_BYTES) {
        Alert.alert('PDF too large', 'Choose a PDF smaller than 50 MB.');
        return;
      }

      update({
        ...exerciseContext,
        coursePdf: {
          uri: asset.uri,
          name: asset.name,
          mimeType: 'application/pdf',
          size: asset.size ?? undefined,
        },
      });
      if (onSelectBook) {
        onSelectBook(undefined);
      }
    } catch {
      Alert.alert('PDF unavailable', 'Scribe could not open the Files picker. Please try again.');
    }
  };

  const hasContent = Boolean(
    exerciseContext.reference || exerciseContext.sourceText || exerciseContext.sourceImage || exerciseContext.coursePdf,
  );

  return (
    <View style={styles.cardContainer}>
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={disabled}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setIsExpanded((previous) => !previous);
        }}
        style={[styles.headerRow, disabled && styles.disabled]}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded, disabled }}
        accessibilityLabel="Exercise context"
      >
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>Exercise Context (optional)</Text>
          {hasContent && <View style={styles.activeDot} />}
        </View>
        <Text style={styles.expandChevron}>{isExpanded ? 'Hide' : 'Add'}</Text>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.bodyContent}>
          <View style={styles.fieldSection}>
            <Text style={styles.fieldLabel}>Exercise Reference</Text>
            <TextInput
              editable={!disabled}
              style={styles.textInput}
              value={exerciseContext.reference ?? ''}
              onChangeText={(reference) => update({ ...exerciseContext, reference })}
              placeholder="e.g., Exercise 4.2b, Spivak Ch. 5 #12"
              placeholderTextColor={COLORS.textMuted}
              accessibilityLabel="Exercise reference"
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </View>

          <View style={styles.fieldSection}>
            <Text style={styles.fieldLabel}>Source Material</Text>
            <View style={styles.sourceButtonRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={disabled}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setShowTextInput((previous) => !previous);
                }}
                style={[styles.sourceButton, showTextInput && styles.sourceButtonActive, disabled && styles.disabled]}
                accessibilityRole="button"
                accessibilityLabel="Type exercise statement"
              >
                <Text style={styles.sourceButtonText}>Type Statement</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={disabled}
                onPress={() => pickExerciseImage('camera')}
                style={[styles.sourceButton, disabled && styles.disabled]}
                accessibilityRole="button"
                accessibilityLabel="Photograph exercise"
              >
                <Text style={styles.sourceButtonText}>Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={disabled}
                onPress={() => pickExerciseImage('library')}
                style={[styles.sourceButton, disabled && styles.disabled]}
                accessibilityRole="button"
                accessibilityLabel="Choose exercise image"
              >
                <Text style={styles.sourceButtonText}>Image</Text>
              </TouchableOpacity>
            </View>
            {showTextInput && (
              <TextInput
                editable={!disabled}
                style={[styles.textInput, styles.multilineInput]}
                value={exerciseContext.sourceText ?? ''}
                onChangeText={(sourceText) => update({ ...exerciseContext, sourceText })}
                placeholder="Type or paste the full problem statement here..."
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                accessibilityLabel="Exercise statement"
                onFocus={onFocus}
                onBlur={onBlur}
              />
            )}
          </View>

          <View style={styles.fieldSection}>
            <Text style={styles.fieldLabel}>Course PDF</Text>
            {availableBooks && availableBooks.length > 0 && (
              <View style={styles.libraryBooksContainer}>
                <Text style={styles.subFieldLabel}>Select from Library</Text>
                <View style={styles.bookList}>
                  {availableBooks.map((book) => {
                    const isSelected = selectedBookId === book.id;
                    return (
                      <TouchableOpacity
                        key={book.id}
                        activeOpacity={0.7}
                        disabled={disabled}
                        onPress={() => {
                          if (isSelected) {
                            if (onSelectBook) onSelectBook(undefined);
                            update({ ...exerciseContext, coursePdf: undefined });
                          } else {
                            if (onSelectBook) onSelectBook(book.id);
                            update({
                              ...exerciseContext,
                              coursePdf: {
                                uri: book.uri,
                                name: book.name,
                                mimeType: 'application/pdf',
                                size: book.size,
                                bookId: book.id,
                                remoteName: book.remotePdfName,
                                remoteTimestamp: book.remotePdfTimestamp,
                              },
                            });
                          }
                        }}
                        style={[
                          styles.bookItem,
                          isSelected && styles.bookItemSelected,
                          disabled && styles.disabled,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Select library book ${book.name}`}
                      >
                        <Text style={[styles.bookItemText, isSelected && styles.bookItemTextSelected]} numberOfLines={1}>
                          {isSelected ? '✓ ' : ''}{book.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.orDividerRow}>
                  <View style={styles.orDividerLine} />
                  <Text style={styles.orDividerText}>or upload local PDF</Text>
                  <View style={styles.orDividerLine} />
                </View>
              </View>
            )}
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={disabled}
              onPress={pickCoursePdf}
              style={[styles.pdfButton, disabled && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel="Choose course PDF"
              accessibilityHint="Select one PDF up to 50 megabytes"
            >
              <Text style={styles.pdfButtonText}>Choose PDF</Text>
            </TouchableOpacity>
            <Text style={styles.privacyNotice}>
              PDFs are uploaded temporarily to Google only while your proof is evaluated.
            </Text>
            {exerciseContext.coursePdf && (
              <View style={styles.attachmentRow}>
                <View style={styles.attachmentText}>
                  <Text style={styles.attachmentName} numberOfLines={1}>{exerciseContext.coursePdf.name}</Text>
                  <Text style={styles.attachmentMeta}>{formatBytes(exerciseContext.coursePdf.size)} · PDF</Text>
                </View>
                <TouchableOpacity
                  disabled={disabled}
                  onPress={() => {
                    update({ ...exerciseContext, coursePdf: undefined });
                    if (onSelectBook) onSelectBook(undefined);
                  }}
                  style={styles.removeButton}
                  accessibilityRole="button"
                  accessibilityLabel="Remove course PDF"
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {exerciseContext.sourceImage && (
            <View style={styles.imagePreviewWrapper}>
              <Text style={styles.fieldLabel}>Attached Exercise Image</Text>
              <View style={styles.imageCard}>
                <Image source={{ uri: exerciseContext.sourceImage.uri }} style={styles.sourceImage} resizeMode="cover" />
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={disabled}
                  onPress={() => update({ ...exerciseContext, sourceImage: undefined })}
                  style={styles.removeImageButton}
                  accessibilityRole="button"
                  accessibilityLabel="Remove attached exercise image"
                >
                  <Text style={styles.removeImageText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

function formatBytes(size: number | undefined): string {
  if (size === undefined) return 'Size unavailable';
  return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

const styles = StyleSheet.create({
  cardContainer: { width: '100%', backgroundColor: COLORS.bgCard, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', marginVertical: SPACING.xs, overflow: 'hidden' },
  headerRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 4 },
  headerTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs + 2 },
  headerTitle: { fontSize: FONT_SIZES.sm + 1, fontWeight: '700', color: COLORS.textPrimary },
  activeDot: { width: 8, height: 8, borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.accent },
  expandChevron: { fontSize: FONT_SIZES.xs, color: COLORS.primaryLight, fontWeight: '700' },
  bodyContent: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.06)', gap: SPACING.md },
  fieldSection: { marginTop: SPACING.sm },
  fieldLabel: { fontSize: FONT_SIZES.xs, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  subFieldLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, fontWeight: '600', marginBottom: SPACING.xs },
  libraryBooksContainer: { marginBottom: SPACING.xs },
  bookList: { gap: SPACING.xs },
  bookItem: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.bgSurface, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  bookItemSelected: { backgroundColor: 'rgba(99, 102, 241, 0.18)', borderColor: COLORS.primary },
  bookItemText: { color: COLORS.textPrimary, fontSize: FONT_SIZES.sm, fontWeight: '500' },
  bookItemTextSelected: { color: COLORS.primaryLight, fontWeight: '700' },
  orDividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: SPACING.sm, gap: SPACING.xs },
  orDividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  orDividerText: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted },
  textInput: { backgroundColor: COLORS.bgSurface, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 2, color: COLORS.textPrimary, fontSize: FONT_SIZES.sm, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  multilineInput: { minHeight: 80, marginTop: SPACING.xs },
  sourceButtonRow: { flexDirection: 'row', gap: SPACING.sm },
  sourceButton: { flex: 1, minHeight: 44, backgroundColor: COLORS.bgSurface, borderRadius: BORDER_RADIUS.md, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)' },
  sourceButtonActive: { borderColor: COLORS.primaryLight, backgroundColor: 'rgba(99, 102, 241, 0.15)' },
  sourceButtonText: { color: COLORS.textPrimary, fontSize: FONT_SIZES.xs, fontWeight: '600', textAlign: 'center' },
  pdfButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.bgSurface, borderWidth: 1, borderColor: COLORS.primaryLight },
  pdfButtonText: { color: COLORS.primaryLight, fontSize: FONT_SIZES.sm, fontWeight: '700' },
  privacyNotice: { marginTop: SPACING.xs, fontSize: FONT_SIZES.xs, lineHeight: 16, color: COLORS.textMuted },
  attachmentRow: { marginTop: SPACING.sm, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.bgSurface },
  attachmentText: { flex: 1, minWidth: 0 },
  attachmentName: { color: COLORS.textPrimary, fontSize: FONT_SIZES.sm, fontWeight: '600' },
  attachmentMeta: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs, marginTop: 2 },
  removeButton: { minHeight: 36, justifyContent: 'center', paddingHorizontal: SPACING.sm },
  removeButtonText: { color: COLORS.error, fontSize: FONT_SIZES.xs, fontWeight: '700' },
  imagePreviewWrapper: { marginTop: SPACING.xs },
  imageCard: { height: 120, borderRadius: BORDER_RADIUS.md, overflow: 'hidden', position: 'relative', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)' },
  sourceImage: { width: '100%', height: '100%' },
  removeImageButton: { position: 'absolute', top: SPACING.xs, right: SPACING.xs, minHeight: 36, justifyContent: 'center', backgroundColor: 'rgba(239, 68, 68, 0.9)', paddingHorizontal: SPACING.sm, borderRadius: BORDER_RADIUS.sm },
  removeImageText: { color: '#ffffff', fontSize: FONT_SIZES.xs, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});

export default ExerciseContextPanel;
