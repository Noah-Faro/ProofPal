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

  it('handles parenthetical math blocks \\[ and \\( correctly', () => {
    const input = 'Here is \\[ x^2 \\] and \\( y \\)';
    const output = sanitizeFeedbackMarkdown(input);
    expect(output).toBe('Here is $$ x^2 $$ and $ y $');
  });

  it('handles double backslashes in math blocks without double escaping', () => {
    const input = 'Matrix: $$ \\begin{matrix} 1 & 2 \\\\ 3 & 4 \\end{matrix} $$';
    const output = sanitizeFeedbackMarkdown(input);
    expect(output).toBe('Matrix: $$ \\begin{matrix} 1 & 2 \\\\ 3 & 4 \\end{matrix} $$');
  });

  it('inserts spaces into squashed LaTeX commands', () => {
    const input = 'Bad math: $\\leqm$ and $\\neqn$';
    const output = sanitizeFeedbackMarkdown(input);
    expect(output).toBe('Bad math: $\\leq m$ and $\\neq n$');
  });
});
