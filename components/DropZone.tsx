import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SUPPORTED_IMAGE_MIME_TYPES, type LocalAttachment } from '../types/proof';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

let NativeDragDropView: React.ComponentType<any> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const module = require('expo-drag-drop-content-view');
  NativeDragDropView = module.DragDropContentView || module.default;
} catch {
  NativeDragDropView = null;
}

export interface DropZoneProps {
  onImageReceived: (image: LocalAttachment) => void;
  currentImage?: LocalAttachment;
  onClear: () => void;
  disabled?: boolean;
}

function inferredMime(uri: string): string | undefined {
  const extension = uri.split('?')[0]?.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'heic') return 'image/heic';
  if (extension === 'heif') return 'image/heif';
  return undefined;
}

function isSupported(mimeType: string | undefined): boolean {
  return SUPPORTED_IMAGE_MIME_TYPES.includes(mimeType as (typeof SUPPORTED_IMAGE_MIME_TYPES)[number]);
}

export const DropZone: React.FC<DropZoneProps> = ({
  onImageReceived,
  currentImage,
  onClear,
  disabled = false,
}) => {
  const [isDragHovering, setIsDragHovering] = useState(false);
  const [isLoadingPicker, setIsLoadingPicker] = useState(false);

  const acceptImage = (asset: LocalAttachment) => {
    const mimeType = asset.mimeType || inferredMime(asset.uri);
    if (!isSupported(mimeType)) {
      Alert.alert('Unsupported image', 'Use a JPEG, PNG, WebP, HEIC, or HEIF image.');
      return;
    }
    onImageReceived({ ...asset, mimeType: mimeType! });
  };

  const handlePickImage = async () => {
    if (disabled) return;
    try {
      setIsLoadingPicker(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to select a proof image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });
      const asset = !result.canceled ? result.assets[0] : undefined;
      if (asset) {
        acceptImage({
          uri: asset.uri,
          name: asset.fileName ?? 'proof-image',
          mimeType: asset.mimeType ?? '',
          size: asset.fileSize ?? undefined,
        });
      }
    } catch {
      Alert.alert('Image unavailable', 'Scribe could not open the image picker. Please try again.');
    } finally {
      setIsLoadingPicker(false);
    }
  };

  const handleDropEvent = (event: any) => {
    setIsDragHovering(false);
    if (disabled) return;
    const asset = event?.assets?.[0] ?? event?.nativeEvent?.assets?.[0];
    if (asset?.uri) {
      acceptImage({
        uri: asset.uri,
        name: asset.name ?? asset.fileName ?? 'proof-image',
        mimeType: asset.mimeType ?? asset.type ?? inferredMime(asset.uri) ?? '',
        size: asset.size ?? undefined,
      });
    }
  };

  const content = (
    <View style={styles.dropZoneContent} pointerEvents={disabled ? 'none' : 'auto'}>
      {currentImage ? (
        <View style={styles.imagePreviewContainer}>
          <Image source={{ uri: currentImage.uri }} style={styles.imagePreview} resizeMode="contain" />
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={disabled}
            onPress={onClear}
            style={styles.clearButton}
            accessibilityRole="button"
            accessibilityLabel="Remove current proof image"
          >
            <Text style={styles.clearButtonText}>Remove</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            disabled={disabled}
            onPress={handlePickImage}
            style={styles.changeImageBadge}
            accessibilityRole="button"
            accessibilityLabel="Change proof image"
          >
            <Text style={styles.changeImageText}>Change Image</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={disabled || isLoadingPicker}
          onPress={handlePickImage}
          style={[styles.placeholderContainer, disabled && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel="Drag a proof image here or select from photo library"
          accessibilityHint="JPEG, PNG, WebP, HEIC, and HEIF are supported"
        >
          {isLoadingPicker ? <ActivityIndicator size="large" color={COLORS.primaryLight} /> : <>
            <Text style={styles.primaryText}>Drag your proof here</Text>
            <Text style={styles.secondaryText}>Drop an image from Goodnotes or tap to select</Text>
            <View style={styles.pickerButton}><Text style={styles.pickerButtonText}>Select Image</Text></View>
          </>}
        </TouchableOpacity>
      )}
    </View>
  );

  if (NativeDragDropView) {
    const DragDropView = NativeDragDropView;
    return (
      <DragDropView
        style={[styles.container, isDragHovering && styles.containerHovering, currentImage ? styles.containerLoaded : styles.containerEmpty, disabled && styles.disabled]}
        allowedMimeTypes={[...SUPPORTED_IMAGE_MIME_TYPES]}
        onDrop={handleDropEvent}
        onEnter={() => !disabled && setIsDragHovering(true)}
        onExit={() => setIsDragHovering(false)}
      >
        {content}
      </DragDropView>
    );
  }

  return <View style={[styles.container, currentImage ? styles.containerLoaded : styles.containerEmpty, disabled && styles.disabled]}>{content}</View>;
};

const styles = StyleSheet.create({
  container: { width: '100%', minHeight: 280, borderRadius: BORDER_RADIUS.xl, overflow: 'hidden', backgroundColor: COLORS.bgDropZone, marginVertical: SPACING.sm },
  containerEmpty: { borderWidth: 2, borderColor: COLORS.primaryLight, borderStyle: 'dashed' },
  containerHovering: { backgroundColor: COLORS.bgDropZoneActive, borderColor: COLORS.accent, borderWidth: 3 },
  containerLoaded: { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', backgroundColor: COLORS.bgCard },
  dropZoneContent: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  placeholderContainer: { width: '100%', minHeight: 280, padding: SPACING.xl, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.xs, textAlign: 'center' },
  secondaryText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING.lg },
  pickerButton: { minHeight: 44, justifyContent: 'center', backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, borderRadius: BORDER_RADIUS.md },
  pickerButtonText: { color: '#ffffff', fontSize: FONT_SIZES.sm, fontWeight: '700' },
  imagePreviewContainer: { width: '100%', height: 320, position: 'relative', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0918', padding: SPACING.sm },
  imagePreview: { width: '100%', height: '100%', borderRadius: BORDER_RADIUS.md },
  clearButton: { position: 'absolute', top: SPACING.md, right: SPACING.md, minHeight: 36, justifyContent: 'center', backgroundColor: 'rgba(15, 13, 35, 0.85)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: SPACING.sm, borderRadius: BORDER_RADIUS.full },
  clearButtonText: { color: COLORS.error, fontSize: FONT_SIZES.xs, fontWeight: '700' },
  changeImageBadge: { position: 'absolute', bottom: SPACING.md, minHeight: 36, justifyContent: 'center', backgroundColor: 'rgba(26, 26, 46, 0.9)', paddingHorizontal: SPACING.md, borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)' },
  changeImageText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.xs, fontWeight: '600' },
  disabled: { opacity: 0.45 },
});

export default DropZone;
