import React, { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { EnrichedMarkdownText, type MarkdownStyle } from 'react-native-enriched-markdown';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';

export interface MarkdownRendererProps {
  content: string;
  style?: ViewStyle;
}

/** Convert stray inequality symbols outside math delimiters to LaTeX. */
function sanitizeLatex(text: string): string {
  // Don't touch content inside $...$ or $$...$$
  return text.replace(/(?<![\$])(?:<=|≤)/g, '$\\le$')
             .replace(/(?<![\$])(?:>=|≥)/g, '$\\ge$')
             .replace(/(?<![\$])(?:!=|≠)/g, '$\\neq$');
}

/** Remove external image directives before rendering untrusted AI output natively. */
export function sanitizeFeedbackMarkdown(content: string): string {
  let cleaned = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
  cleaned = cleaned.replace(/!\[[^\]]*\]\([^\s)]+(?:\s+[^)]*)?\)/g, '[Image omitted]');
  cleaned = sanitizeLatex(cleaned);
  return cleaned;
}

const markdownStyle: MarkdownStyle = {
  paragraph: { color: COLORS.textPrimary, fontSize: FONT_SIZES.md, lineHeight: 24, marginBottom: SPACING.sm },
  h1: { color: COLORS.primaryLight, fontSize: FONT_SIZES.xl, fontWeight: '700', marginTop: SPACING.md, marginBottom: SPACING.sm },
  h2: { color: COLORS.primaryLight, fontSize: FONT_SIZES.lg, fontWeight: '700', marginTop: SPACING.md, marginBottom: SPACING.xs },
  h3: { color: COLORS.textPrimary, fontSize: FONT_SIZES.md, fontWeight: '700', marginTop: SPACING.sm, marginBottom: SPACING.xs },
  strong: { color: COLORS.textPrimary },
  em: { color: COLORS.textPrimary },
  code: { color: COLORS.accent, backgroundColor: COLORS.bgSurface },
  codeBlock: { color: COLORS.textPrimary, backgroundColor: COLORS.bgSurface, padding: SPACING.sm },
  blockquote: { color: COLORS.textPrimary, borderColor: COLORS.primary, borderWidth: 1 },
  link: { color: COLORS.primaryLight },
  math: { color: COLORS.textPrimary, backgroundColor: COLORS.bgSurface, padding: SPACING.sm },
  inlineMath: { color: COLORS.textPrimary },
};

export function MarkdownRenderer({ content, style }: MarkdownRendererProps) {
  const safeMarkdown = useMemo(() => sanitizeFeedbackMarkdown(content), [content]);
  return (
    <View style={[styles.container, style]}>
      <EnrichedMarkdownText
        markdown={safeMarkdown}
        flavor="github"
        markdownStyle={markdownStyle}
        containerStyle={styles.markdown}
        enableLinkPreview={false}
        onLinkPress={() => undefined}
        onLinkLongPress={() => undefined}
        selectionMenuConfig={{ copyImageUrl: { enabled: false } }}
        accessibilityLabel="Proof feedback"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  markdown: { width: '100%' },
});

export default MarkdownRenderer;
