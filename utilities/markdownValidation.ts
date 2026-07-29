export type MarkdownValidationError = {
  code: string;
  message: string;
};

export type MarkdownValidationResult =
  | { ok: true; markdown: string; warnings: MarkdownValidationError[] }
  | { ok: false; markdown: string; errors: MarkdownValidationError[] };

export function validateFeedbackMarkdown(markdown: string): MarkdownValidationResult {
  const errors: MarkdownValidationError[] = [];
  
  if (markdown.length > 100_000) {
    errors.push({ code: 'LIMIT_EXCEEDED', message: 'Maximum Markdown message length (100,000 characters) exceeded.' });
  }

  const mathBlocks = markdown.match(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$|\\\[[\s\S]*?\\\]|\\\((?:[^\\\n]|\\(?!\)))*?\\\))/g) || [];
  if (mathBlocks.length > 256) {
    errors.push({ code: 'LIMIT_EXCEEDED', message: 'Maximum number of math spans (256) exceeded.' });
  }
  for (const block of mathBlocks) {
    if (block.length > 4096) {
      errors.push({ code: 'LIMIT_EXCEEDED', message: 'Maximum individual math span length (4,096 characters) exceeded.' });
      break;
    }
  }
  // 1. Check for unbalanced math delimiters ($)
  // Simple heuristic: split by '$' and if length is even, it's unbalanced.
  // Ignore \$ (escaped dollars).
  const unescapedDollars = markdown.match(/(?<!\\)\$/g) || [];
  if (unescapedDollars.length % 2 !== 0) {
    errors.push({ code: 'UNBALANCED_MATH_DELIMITER', message: 'Math delimiters ($) are not balanced.' });
  }

  // 2. Check for empty math spans ($$)
  if (/\$(?!\$)[ \t]*\$/.test(markdown) || /\$\$[ \t]*\$\$/.test(markdown)) {
    errors.push({ code: 'EMPTY_MATH_SPAN', message: 'Contains an empty math span.' });
  }

  // 3. Check for bare math syntax in prose (naked ^ or _)
  // This is tricky. If we find ^ or _ OUTSIDE of a math block, it's an error.
  // We can strip math blocks first, then check what's left.
  const stripped = markdown.replace(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g, '');
  if (/(?<!\\)[\^_]/.test(stripped)) {
    errors.push({ code: 'BARE_MATH_SYNTAX', message: 'Contains unescaped mathematical syntax (^ or _) outside of a math span.' });
  }

  // 4. Check for incomplete relation in math spans
  // E.g., "$n \le$" or "$ \ge m$". 
  // We look for relations at the very boundary of a math block or followed/preceded directly by another relation/equals.
  for (const block of mathBlocks) {
    // Trim the $ delimiters
    const inner = block.replace(/^\$+/, '').replace(/\$+$/, '').trim();
    if (/^(?:\\le|\\leq|\\ge|\\geq|\\neq|\\ne|=|\\approx|<|>)(?:\s|$)/.test(inner) || 
        /(?:^|\s)(?:\\le|\\leq|\\ge|\\geq|\\neq|\\ne|=|\\approx|<|>)$/.test(inner)) {
      errors.push({ code: 'INCOMPLETE_RELATION', message: 'Contains an incomplete relation (e.g., missing an operand).' });
      break;
    }
  }

  // 5. Check for unbalanced braces { } inside math blocks
  for (const block of mathBlocks) {
     let braceCount = 0;
     for (let i = 0; i < block.length; i++) {
        if (block[i] === '\\') { i++; continue; } // skip escaped chars
        if (block[i] === '{') braceCount++;
        if (block[i] === '}') braceCount--;
     }
     if (braceCount !== 0) {
        errors.push({ code: 'UNBALANCED_BRACE', message: 'Contains unbalanced braces { }.' });
        break;
     }
  }

  if (errors.length > 0) {
    return { ok: false, markdown, errors };
  }
  return { ok: true, markdown, warnings: [] };
}
