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
  it('converts ALL single backticks to inline math', () => {
    const input = 'Here is a variable `m < n` and `e`.';
    const output = sanitizeFeedbackMarkdown(input);
    expect(output).toBe('Here is a variable $m < n$ and $e$.');
  });

  it('aggressively strips thinking and thought tags, even if unclosed or multiline', () => {
    const input1 = '<thinking>\nThis is a thought\n</thinking>And this is not.';
    expect(sanitizeFeedbackMarkdown(input1)).toBe('And this is not.');

    const input2 = '<thought>\nThis is another thought\n</thought>Yes.';
    expect(sanitizeFeedbackMarkdown(input2)).toBe('Yes.');

    const input3 = '<thinking>\nWait, I never closed this thought...';
    expect(sanitizeFeedbackMarkdown(input3)).toBe('');
  });

  it('repairs missing backslashes on standard commands and fixes eq inside math blocks ONLY', () => {
    const inputMath = 'Math: $m neq n$ and $a leq b$ and $x eq y$';
    expect(sanitizeFeedbackMarkdown(inputMath)).toBe('Math: $m \\neq n$ and $a \\leq b$ and $x = y$');

    const inputProse = 'Prose containing neq or eq or leq outside of math blocks remains untouched';
    expect(sanitizeFeedbackMarkdown(inputProse)).toBe('Prose containing neq or eq or leq outside of math blocks remains untouched');
  });

  it('replaces ||...|| and ... only inside math blocks', () => {
    const input = 'Outside ||norm|| and ... vs inside: $||v||$ and $a ... b$';
    expect(sanitizeFeedbackMarkdown(input)).toBe('Outside ||norm|| and ... vs inside: $\\lVert v \\rVert$ and $a \\dots b$');
  });
});

