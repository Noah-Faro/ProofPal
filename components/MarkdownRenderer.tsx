import React, { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { EnrichedMarkdownText, type MarkdownStyle } from 'react-native-enriched-markdown';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS } from '../constants/theme';

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
  // 1. Strip thinking blocks and images (including unclosed blocks)
  let cleaned = content.replace(/<(?:thinking|thought)>[\s\S]*?(?:<\/(?:thinking|thought)>|$)/gi, '');
  cleaned = cleaned.replace(/!\[[^\]]*\]\([^\s)]+(?:\s+[^)]*)?\)/g, '[Image omitted]');

  // 1.5. Convert ALL inline backticks to LaTeX math (Scribe does not write programming code)
  cleaned = cleaned.replace(/`([^`\n]+)`/g, (match, inner) => {
    return `$${inner}$`;
  });

  // 2. Extract math blocks into placeholders to protect them
  const mathBlocks: string[] = [];
  let placeholderText = cleaned.replace(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$|\\\[[\s\S]*?\\\]|\\\((?:[^\\\n]|\\(?!\)))*?\\\))/g, (match) => {
    mathBlocks.push(match);
    return `___MATH_BLOCK_${mathBlocks.length - 1}___`;
  });

  // 3. Convert bare operators in text
  placeholderText = sanitizeLatex(placeholderText);

  // Protect any math blocks created by sanitizeLatex
  placeholderText = placeholderText.replace(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$|\\\[[\s\S]*?\\\]|\\\((?:[^\\\n]|\\(?!\)))*?\\\))/g, (match) => {
    mathBlocks.push(match);
    return `___MATH_BLOCK_${mathBlocks.length - 1}___`;
  });

  // 4. Double-escape backslashes on the text ONLY
  const textWithEscapedBackslashes = placeholderText.replace(/\\/g, '\\\\');

  // 5. Restore math blocks without double-escaping them, and standardize on $ / $$
  return textWithEscapedBackslashes.replace(/___MATH_BLOCK_(\d+)___/g, (_, indexStr) => {
    const idx = parseInt(indexStr, 10);
    let block = mathBlocks[idx] ?? '';
    
    if (block.startsWith('\\[') && block.endsWith('\\]')) {
      block = '$$' + block.slice(2, -2) + '$$';
    } else if (block.startsWith('\\(') && block.endsWith('\\)')) {
      block = '$' + block.slice(2, -2) + '$';
    }
    
    // Fix squashed commands inside math blocks, e.g., \leqm -> \leq m
    block = block.replace(/\\(leq|le|geq|ge|neq|ne|approx|in|subset|cup|cap|to|rightarrow)([a-zA-Z]+)/g, (match, cmd, letters) => {
      if (['left', 'right', 'inf', 'int', 'sub', 'sup', 'text', 'begin', 'end'].includes(cmd + letters)) return match;
      return '\\' + cmd + ' ' + letters;
    });
    
    return block;
  });
}

const markdownStyle: MarkdownStyle = {
  paragraph: { color: COLORS.textPrimary, fontSize: FONT_SIZES.md, lineHeight: 24, marginBottom: SPACING.sm },
  h1: { color: COLORS.primaryLight, fontSize: FONT_SIZES.xl, fontWeight: '700', marginTop: SPACING.md, marginBottom: SPACING.sm },
  h2: { color: COLORS.primaryLight, fontSize: FONT_SIZES.lg, fontWeight: '700', marginTop: SPACING.md, marginBottom: SPACING.xs },
  h3: { color: COLORS.textPrimary, fontSize: FONT_SIZES.md, fontWeight: '700', marginTop: SPACING.sm, marginBottom: SPACING.xs },
  strong: { color: COLORS.textPrimary },
  em: { color: COLORS.textPrimary },
  list: { color: COLORS.textPrimary, bulletColor: COLORS.textPrimary, markerColor: COLORS.textPrimary },
  code: { color: COLORS.accent, backgroundColor: COLORS.bgSurface },
  codeBlock: { color: COLORS.textPrimary, backgroundColor: COLORS.bgSurface, padding: SPACING.sm },
  blockquote: { color: COLORS.textPrimary, backgroundColor: COLORS.bgSurface, borderColor: COLORS.primary, borderWidth: 1, padding: SPACING.sm, borderRadius: BORDER_RADIUS.sm, overflow: 'hidden' },
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
