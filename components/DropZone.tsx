import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

// Safely attempt to load native drag & drop component if present
let NativeDragDropView: any = null;
try {
  const mod = require('expo-drag-drop-content-view');
  NativeDragDropView = mod.DragDropContentView || mod.default;
} catch (e) {
  NativeDragDropView = null;
}

/**
 * Props for the {@link DropZone} component.
 */
export interface DropZoneProps {
  /** Callback invoked when a proof image is dropped or picked via file picker */
  onImageReceived: (imageUri: string) => void;
  /** URI of the currently loaded proof image (if any) */
  currentImage?: string;
  /** Callback to clear the currently loaded image */
  onClear: () => void;
}

/**
 * DropZone is the central drag-and-drop target area for ProofPal.
 *
 * Designed for iPad split-screen work with Goodnotes / Notability.
 * Students can drag an exported snippet directly onto the zone or tap to select.
 */
export const DropZone: React.FC<DropZoneProps> = ({
  onImageReceived,
  currentImage,
  onClear,
}) => {
  const [isDragHovering, setIsDragHovering] = useState(false);
  const [isLoadingPicker, setIsLoadingPicker] = useState(false);

  /**
   * Triggers the native image library picker as a manual fallback.
   */
  const handlePickImage = async () => {
    try {
      setIsLoadingPicker(true);
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Needed',
          'Photo library access is required to upload mathematical proof images.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedUri = result.assets[0].uri;
        onImageReceived(selectedUri);
      }
    } catch (err) {
      console.error('Failed to pick image:', err);
      Alert.alert('Error', 'Failed to open image library.');
    } finally {
      setIsLoadingPicker(false);
    }
  };

  /**
   * Safely extracts asset URI from native drop events.
   */
  const handleDropEvent = (event: any) => {
    setIsDragHovering(false);
    const assets = event?.assets || event?.nativeEvent?.assets || [];
    if (assets.length > 0 && assets[0]?.uri) {
      onImageReceived(assets[0].uri);
    }
  };

  // Content rendered inside dropzone
  const innerContent = (
    <View style={styles.dropZoneContent}>
      {currentImage ? (
        <View style={styles.imagePreviewContainer}>
          <Image
            source={{ uri: currentImage }}
            style={styles.imagePreview}
            resizeMode="contain"
          />
          {/* Top-Right Clear Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onClear}
            style={styles.clearButton}
            accessibilityLabel="Remove current proof image"
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handlePickImage}
            style={styles.changeImageBadge}
          >
            <Text style={styles.changeImageText}>Change Image</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handlePickImage}
          style={styles.placeholderContainer}
          accessibilityRole="button"
          accessibilityLabel="Drag proof image here or tap to select from photo library"
        >
          {isLoadingPicker ? (
            <ActivityIndicator size="large" color={COLORS.primaryLight} />
          ) : (
            <>
              <View style={styles.iconCircle}>
                <Text style={styles.iconText}>📑</Text>
              </View>
              <Text style={styles.primaryText}>Drag your proof here</Text>
              <Text style={styles.secondaryText}>
                Drop an image from Goodnotes or tap to select
              </Text>
              <View style={styles.pickerButton}>
                <Text style={styles.pickerButtonText}>📁 Select Image</Text>
              </View>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  // If native drag drop component is available, wrap with it; otherwise standard View
  if (NativeDragDropView) {
    return (
      <NativeDragDropView
        style={[
          styles.container,
          isDragHovering && styles.containerHovering,
          currentImage ? styles.containerLoaded : styles.containerEmpty,
        ]}
        onDrop={handleDropEvent}
        onDragEnter={() => setIsDragHovering(true)}
        onDragLeave={() => setIsDragHovering(false)}
      >
        {innerContent}
      </NativeDragDropView>
    );
  }

  return (
    <View
      style={[
        styles.container,
        currentImage ? styles.containerLoaded : styles.containerEmpty,
      ]}
    >
      {innerContent}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: 280,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    backgroundColor: COLORS.bgDropZone,
    marginVertical: SPACING.sm,
  },
  containerEmpty: {
    borderWidth: 2,
    borderColor: COLORS.primaryLight,
    borderStyle: 'dashed',
  },
  containerHovering: {
    backgroundColor: COLORS.bgDropZoneActive,
    borderColor: COLORS.accent,
    borderWidth: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  containerLoaded: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: COLORS.bgCard,
  },
  dropZoneContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderContainer: {
    width: '100%',
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  iconText: {
    fontSize: FONT_SIZES.xxl,
  },
  primaryText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  secondaryText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  pickerButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.md,
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  pickerButtonText: {
    color: '#ffffff',
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  imagePreviewContainer: {
    width: '100%',
    height: 320,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0918',
    padding: SPACING.sm,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: BORDER_RADIUS.md,
  },
  clearButton: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(15, 13, 35, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  clearButtonText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  changeImageBadge: {
    position: 'absolute',
    bottom: SPACING.md,
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  changeImageText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
});

export default DropZone;
