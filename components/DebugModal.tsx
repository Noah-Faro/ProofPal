import React from 'react';
import {
  View,
  Text,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';
import { prepareFeedbackMarkdown } from './MarkdownRenderer';

interface DebugModalProps {
  visible: boolean;
  content: string | null;
  onClose: () => void;
}

export function DebugModal({ visible, content, onClose }: DebugModalProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bgDark }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: SPACING.md, borderBottomWidth: 1, borderColor: COLORS.bgSurface }}>
          <Text style={{ fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.textPrimary }}>Debug Logs</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ fontSize: FONT_SIZES.md, color: COLORS.primaryLight }}>Close</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, padding: SPACING.md }}>
          <Text style={{ fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.xs }}>Raw Gemini Output</Text>
          <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, color: COLORS.textSecondary, marginBottom: SPACING.lg }} selectable>
            {content}
          </Text>
          
          <Text style={{ fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.xs }}>Post-Processed Output</Text>
          <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, color: COLORS.textSecondary, marginBottom: SPACING.xl }} selectable>
            {content ? prepareFeedbackMarkdown(content) : ''}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
