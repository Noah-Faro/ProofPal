import React, { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { EnrichedMarkdownText, type MarkdownStyle } from 'react-native-enriched-markdown';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import { validateFeedbackMarkdown } from '../utilities/markdownValidation';

export interface MarkdownRendererProps {
  content: string;
  style?: ViewStyle;
}

export function normalizeFeedbackMarkdown(content: string): string {
  // 1. Strip thinking blocks and images (including unclosed blocks)
  let cleaned = content.replace(/<(?:thinking|thought)>[\s\S]*?(?:<\/(?:thinking|thought)>|$)/gi, '');
  cleaned = cleaned.replace(/!\[[^\]]*\]\([^\s)]+(?:\s+[^)]*)?\)/g, '[Image omitted]');

  // 1.5. Convert ALL inline backticks to LaTeX math
  cleaned = cleaned.replace(/`([^`\n]+)`/g, (match, inner) => {
    return `$${inner}$`;
  });

  // 2. Wrap Unwrapped Equations: lines containing = and either ^, _, or \ but lacking $
  cleaned = cleaned.split('\n').map(line => {
    if (line.includes('=') && (line.includes('^') || line.includes('_') || line.includes('\\')) && !line.includes('$')) {
      return `$$${line}$$`;
    }
    return line;
  }).join('\n');

  // 3. Extract math blocks into placeholders to protect them
  const mathBlocks: string[] = [];
  let placeholderText = cleaned.replace(/(\$\$[\s\S]*?\$\$|\$(?:[^$\n]|\n(?!\n)){1,256}?\$|\\\[[\s\S]*?\\\]|\\\((?:[^\\\n]|\\(?!\)))*?\\\))/g, (match) => {
    mathBlocks.push(match);
    return `___MATH_BLOCK_${mathBlocks.length - 1}___`;
  });

  // 4. Double-escape backslashes on the text ONLY
  let textWithEscapedBackslashes = placeholderText.replace(/\\/g, '\\\\');

  // 5. Restore math blocks without double-escaping them, and standardize on $ / $$
  return textWithEscapedBackslashes.replace(/___MATH_BLOCK_(\d+)___/g, (_, indexStr) => {
    const idx = parseInt(indexStr, 10);
    let block = mathBlocks[idx] ?? '';
    
    if (block.startsWith('\\[') && block.endsWith('\\]')) {
      block = '$$' + block.slice(2, -2) + '$$';
    } else if (block.startsWith('\\(') && block.endsWith('\\)')) {
      block = '$' + block.slice(2, -2) + '$';
    }
    
    // Convert ||...|| to \lVert ... \rVert
    block = block.replace(/\|\|([\s\S]*?)\|\|/g, (_, inner) => `\\lVert ${inner} \\rVert`);
    
    // Convert ... to \dots
    block = block.replace(/\.\.\./g, '\\dots');
    
    // Replace \beq with =
    block = block.replace(/(?<!\\)\beq\b/g, '=');

    // Fix missing backslashes on standard commands inside math blocks
    block = block.replace(/(?<!\\)\b(leq|geq|neq|approx|alpha|beta|theta|cdot|dots|int|sum|frac|lim|subset|in|cup|cap|to|rightarrow)\b/g, (_, cmd) => `\\${cmd}`);
    
    return block;
  });
}

export function prepareFeedbackMarkdown(markdown: string): string {
  const validation = validateFeedbackMarkdown(markdown);
  if (!validation.ok) {
    return markdown.replace(/\$/g, '\\$').replace(/\\\[/g, '\\\\[').replace(/\\\(/g, '\\\\(');
  }
  return normalizeFeedbackMarkdown(markdown);
}

const markdownStyle: MarkdownStyle = {
  paragraph: { color: COLORS.textPrimary, fontSize: FONT_SIZES.md, lineHeight: 24, marginBottom: SPACING.sm },
  h1: { color: COLORS.textPrimary, fontSize: FONT_SIZES.xl, fontWeight: '700', marginTop: SPACING.md, marginBottom: SPACING.sm },
  h2: { color: COLORS.textPrimary, fontSize: FONT_SIZES.lg, fontWeight: '700', marginTop: SPACING.md, marginBottom: SPACING.xs },
  h3: { color: COLORS.textPrimary, fontSize: FONT_SIZES.md, fontWeight: '700', marginTop: SPACING.sm, marginBottom: SPACING.xs },
  strong: { color: COLORS.textPrimary },
  em: { color: COLORS.textPrimary },
  list: { color: COLORS.textPrimary, bulletColor: COLORS.textPrimary, markerColor: COLORS.textPrimary },
  code: { color: COLORS.accent, backgroundColor: COLORS.bgSurface },
  codeBlock: { color: COLORS.textPrimary, backgroundColor: COLORS.bgSurface, padding: SPACING.sm },
  blockquote: { color: COLORS.textPrimary, backgroundColor: COLORS.bgSurface, borderColor: COLORS.primary, borderWidth: 1 },
  link: { color: COLORS.primaryLight },
  math: { color: COLORS.textPrimary, backgroundColor: COLORS.bgSurface, padding: SPACING.sm },
  inlineMath: { color: COLORS.textPrimary },
};

export function MarkdownRenderer({ content, style }: MarkdownRendererProps) {
  const safeMarkdown = useMemo(() => prepareFeedbackMarkdown(content), [content]);
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
