import { sanitizeFeedbackMarkdown } from '../MarkdownRenderer';

describe('sanitizeFeedbackMarkdown', () => {
  it('removes remote image directives while keeping text feedback', () => {
    expect(sanitizeFeedbackMarkdown('Keep this. ![tracker](https://example.com/pixel.png)')).toBe('Keep this. [Image omitted]');
  });

  it('preserves single backslashes in math blocks like \\left and \\right', () => {
    const input = 'Here is math: $\\left( \\frac{a}{b} \\right) \\le 5$';
    const output = sanitizeFeedbackMarkdown(input);
    expect(output).toBe('Here is math: $\\left( \\frac{a}{b} \\right) \\le 5$');
  });

  it('strips thinking blocks before processing', () => {
    const input = '<thinking>Internal thought with \\left</thinking>Visible text';
    expect(sanitizeFeedbackMarkdown(input)).toBe('Visible text');
  });

  it('converts bare operators in text to math blocks', () => {
    const input = 'If x <= y, then fine.';
    expect(sanitizeFeedbackMarkdown(input)).toBe('If x $\\le$ y, then fine.');
  });
});
