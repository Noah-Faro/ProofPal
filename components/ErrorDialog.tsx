import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { AppError } from '../types/proof';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

export interface ErrorDialogProps {
  error: AppError | null;
  onDismiss: () => void;
  onRetry: () => void;
  onAddApiKey: () => void;
  onOpenSettings: () => void;
}

export function ErrorDialog({ error, onDismiss, onRetry, onAddApiKey, onOpenSettings }: ErrorDialogProps) {
  const titleRef = useRef<Text>(null);

  useEffect(() => {
    if (!error) return;
    const message = `Proof check error. ${error.message}`;
    AccessibilityInfo.announceForAccessibility(message);
    if (typeof findNodeHandle === 'function') {
      const handle = findNodeHandle(titleRef.current);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    }
  }, [error]);

  if (!error) return null;

  const action = error.recoveryAction === 'add-api-key'
    ? { label: 'Add API Key', onPress: onAddApiKey }
    : error.recoveryAction === 'open-settings'
      ? { label: 'Open Settings', onPress: onOpenSettings }
      : error.retryable || error.recoveryAction === 'retry'
        ? { label: 'Retry', onPress: onRetry }
        : undefined;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss} onShow={() => AccessibilityInfo.announceForAccessibility('Proof check error dialog')}>
      <View style={styles.scrim}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text ref={titleRef} style={styles.title} accessibilityRole="header">Proof Check Error</Text>
          <Text style={styles.message}>{error.message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.dismissButton} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss error dialog">
              <Text style={styles.dismissText}>Dismiss</Text>
            </TouchableOpacity>
            {action && (
              <TouchableOpacity style={styles.actionButton} onPress={action.onPress} accessibilityRole="button" accessibilityLabel={action.label}>
                <Text style={styles.actionText}>{action.label}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)', padding: SPACING.lg },
  card: { width: '100%', maxWidth: 480, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.16)', borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.45, shadowRadius: 20, elevation: 12 },
  title: { color: COLORS.error, fontSize: FONT_SIZES.lg, fontWeight: '700', marginBottom: SPACING.sm },
  message: { color: COLORS.textPrimary, fontSize: FONT_SIZES.md, lineHeight: 23 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.lg },
  dismissButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.18)', borderRadius: BORDER_RADIUS.md },
  dismissText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, fontWeight: '700' },
  actionButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: SPACING.md, backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md },
  actionText: { color: '#ffffff', fontSize: FONT_SIZES.sm, fontWeight: '700' },
});

export default ErrorDialog;
