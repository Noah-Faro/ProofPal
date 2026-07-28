import React, { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { EnrichedMarkdownText, type MarkdownStyle } from 'react-native-enriched-markdown';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';

export interface MarkdownRendererProps {
  content: string;
  style?: ViewStyle;
}

function sanitizeLatex(text: string): string {
  return text
    .replace(/(?<![$])(?:<=|≤)/g, '$\\le$')
    .replace(/(?<![$])(?:>=|≥)/g, '$\\ge$')
    .replace(/(?<![$])(?:!=|≠)/g, '$\\neq$')
    .replace(/(?<![$])(?:->|→)/g, '$\\rightarrow$')
    .replace(/(?<![$])(?:=>|⇒)/g, '$\\Rightarrow$')
    .replace(/(?<![$])(?:~|≈)/g, '$\\approx$');
}

export function sanitizeFeedbackMarkdown(content: string): string {
  // 1. Strip thinking blocks and images
  let cleaned = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
  cleaned = cleaned.replace(/!\[[^\]]*\]\([^\s)]+(?:\s+[^)]*)?\)/g, '[Image omitted]');

  // 2. Extract math blocks into placeholders to protect them
  const mathBlocks: string[] = [];
  const placeholderText = cleaned.replace(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g, (match) => {
    mathBlocks.push(match);
    return `___MATH_BLOCK_${mathBlocks.length - 1}___`;
  });

  // 3. Sanitize non-math text (convert bare operators to LaTeX)
  let sanitized = sanitizeLatex(placeholderText);

  // 4. Restore math blocks
  sanitized = sanitized.replace(/___MATH_BLOCK_(\d+)___/g, (_, indexStr) => {
    const idx = parseInt(indexStr, 10);
    return mathBlocks[idx] || '';
  });

  // 5. Double-escape backslashes LAST for react-native-enriched-markdown
  return sanitized.replace(/\\/g, '\\\\');
}

const markdownStyle: MarkdownStyle & Record<string, unknown> = {
  paragraph: { color: COLORS.textPrimary, fontSize: FONT_SIZES.md, lineHeight: 24, marginBottom: SPACING.sm },
  h1: { color: COLORS.primaryLight, fontSize: FONT_SIZES.xl, fontWeight: '700', marginTop: SPACING.md, marginBottom: SPACING.sm },
  h2: { color: COLORS.primaryLight, fontSize: FONT_SIZES.lg, fontWeight: '700', marginTop: SPACING.md, marginBottom: SPACING.xs },
  h3: { color: COLORS.textPrimary, fontSize: FONT_SIZES.md, fontWeight: '700', marginTop: SPACING.sm, marginBottom: SPACING.xs },
  strong: { color: COLORS.textPrimary },
  em: { color: COLORS.textPrimary },
  li: { color: COLORS.textPrimary },
  ul: { color: COLORS.textPrimary },
  ol: { color: COLORS.textPrimary },
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
