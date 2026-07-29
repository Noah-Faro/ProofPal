import { validateFeedbackMarkdown } from '../markdownValidation';

describe('validateFeedbackMarkdown', () => {
  it('passes valid markdown with balanced math delimiters', () => {
    const result = validateFeedbackMarkdown('Let $x = 5$ and $y = 10$. Therefore, $x + y = 15$.');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings).toEqual([]);
    }
  });

  it('passes valid markdown with inline math spanning a single newline', () => {
    const result = validateFeedbackMarkdown('Let $x \n = 5$ and $y = 10$.');
    expect(result.ok).toBe(true);
  });

  it('detects unbalanced math delimiters ($)', () => {
    const result = validateFeedbackMarkdown('The equation $x + y = 5 is incomplete.');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({
        code: 'UNBALANCED_MATH_DELIMITER',
        message: 'Math delimiters ($) are not balanced.',
      });
    }
  });

  it('detects empty math spans ($$ or $ $)', () => {
    const result = validateFeedbackMarkdown('Check this empty span $ $ and $$ $$.');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({
        code: 'EMPTY_MATH_SPAN',
        message: 'Contains an empty math span.',
      });
    }
  });

  it('detects bare math syntax outside math blocks', () => {
    const result = validateFeedbackMarkdown('Variable x_1 and x^2 should be wrapped in math spans.');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({
        code: 'BARE_MATH_SYNTAX',
        message: 'Contains unescaped mathematical syntax (^ or _) outside of a math span.',
      });
    }
  });

  it('detects incomplete relations at boundaries of math spans', () => {
    const result = validateFeedbackMarkdown('We know that $n \\le$ for all $n$.');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({
        code: 'INCOMPLETE_RELATION',
        message: 'Contains an incomplete relation (e.g., missing an operand).',
      });
    }
  });

  it('detects unbalanced braces within math blocks', () => {
    const result = validateFeedbackMarkdown('Consider $\\frac{1}{2$ as a fraction.');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({
        code: 'UNBALANCED_BRACE',
        message: 'Contains unbalanced braces { }.',
      });
    }
  });
});
