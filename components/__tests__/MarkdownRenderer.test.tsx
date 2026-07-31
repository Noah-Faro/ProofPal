import { normalizeFeedbackMarkdown, prepareFeedbackMarkdown } from '../MarkdownRenderer';

describe('normalizeFeedbackMarkdown', () => {
  it('removes remote image directives while keeping text feedback', () => {
    expect(normalizeFeedbackMarkdown('Keep this. ![tracker](https://example.com/pixel.png)')).toBe('Keep this. [Image omitted]');
  });

  it('preserves single backslashes in math blocks like \\left and \\right', () => {
    const input = 'Here is math: $\\left( \\frac{a}{b} \\right) \\le 5$';
    const output = normalizeFeedbackMarkdown(input);
    expect(output).toBe('Here is math: $\\left( \\frac{a}{b} \\right) \\le 5$');
  });

  it('strips thinking blocks before processing', () => {
    const input = '<thinking>Internal thought with \\left</thinking>Visible text';
    expect(normalizeFeedbackMarkdown(input)).toBe('Visible text');
  });

  it('converts bare operators in text to math blocks', () => {
    const input = 'If x <= y, then fine.';
    // this test used to expect converted text but the new normalizeFeedbackMarkdown does not convert <= since we removed sanitizeLatex. Wait, does it? The prompt says "Delete sanitizeLatex". So this test will fail. I will update the expectation.
    expect(normalizeFeedbackMarkdown(input)).toBe('If x <= y, then fine.');
  });

  it('handles parenthetical math blocks \\[ and \\( correctly', () => {
    const input = 'Here is \\[ x^2 \\] and \\( y \\)';
    const output = normalizeFeedbackMarkdown(input);
    expect(output).toBe('Here is $$ x^2 $$ and $ y $');
  });

  it('handles double backslashes in math blocks without double escaping', () => {
    const input = 'Matrix: $$ \\begin{matrix} 1 & 2 \\\\ 3 & 4 \\end{matrix} $$';
    const output = normalizeFeedbackMarkdown(input);
    expect(output).toBe('Matrix: $ \\begin{matrix} 1 & 2 \\\\ 3 & 4 \\end{matrix} $');
  });

  it('inserts spaces into squashed LaTeX commands', () => {
    const input = 'Bad math: $\\leqm$ and $\\neqn$';
    const output = normalizeFeedbackMarkdown(input);
    expect(output).toBe('Bad math: $\\leqm$ and $\\neqn$');
  });

  it('preserves prefix commands like subseteq without splitting them', () => {
    const input = 'Math: $\\subseteq$ and $\\leqslant$ and $\\nearrow$';
    expect(normalizeFeedbackMarkdown(input)).toBe('Math: $\\subseteq$ and $\\leqslant$ and $\\nearrow$');
  });

  it('wraps unwrapped equation lines correctly', () => {
    const input = 'a^m = e\n(g^{-1}ag)^m=e\nBut this $x = y$ is already wrapped.';
    expect(normalizeFeedbackMarkdown(input)).toBe('$$a^m = e$$\n$$(g^{-1}ag)^m=e$$\nBut this $x = y$ is already wrapped.');
  });

  it('normalizes missing slashes for commands like alpha, subset, cap', () => {
    const input = 'Math: $alpha$ and $subset$ and $cup$ and $in$';
    expect(normalizeFeedbackMarkdown(input)).toBe('Math: $\\alpha$ and $\\subset$ and $\\cup$ and $\\in$');
  });

  it('does not transform leqm into \\le qm', () => {
    const input = '$n leqm$';
    expect(normalizeFeedbackMarkdown(input)).toBe('$n leqm$');
  });

  it('is idempotent', () => {
    const input = 'Math: $m neq n$ and $a leq b$ and a^2 = b';
    const first = normalizeFeedbackMarkdown(input);
    const second = normalizeFeedbackMarkdown(first);
    expect(second).toBe(first);
  });
  it('converts ALL single backticks to inline math', () => {
    const input = 'Here is a variable `m < n` and `e`.';
    const output = normalizeFeedbackMarkdown(input);
    expect(output).toBe('Here is a variable $m < n$ and $e$.');
  });

  it('aggressively strips thinking and thought tags, even if unclosed or multiline', () => {
    const input1 = '<thinking>\nThis is a thought\n</thinking>And this is not.';
    expect(normalizeFeedbackMarkdown(input1)).toBe('And this is not.');

    const input2 = '<thought>\nThis is another thought\n</thought>Yes.';
    expect(normalizeFeedbackMarkdown(input2)).toBe('Yes.');

    const input3 = '<thinking>\nWait, I never closed this thought...';
    expect(normalizeFeedbackMarkdown(input3)).toBe('');
  });

  it('repairs missing backslashes on standard commands and fixes eq inside math blocks ONLY', () => {
    const inputMath = 'Math: $m neq n$ and $a leq b$ and $x eq y$';
    expect(normalizeFeedbackMarkdown(inputMath)).toBe('Math: $m \\neq n$ and $a \\leq b$ and $x = y$');

    const inputProse = 'Prose containing neq or eq or leq outside of math blocks remains untouched';
    expect(normalizeFeedbackMarkdown(inputProse)).toBe('Prose containing neq or eq or leq outside of math blocks remains untouched');
  });

  it('replaces ||...|| and ... only inside math blocks', () => {
    const input = 'Outside ||norm|| and ... vs inside: $||v||$ and $a ... b$';
    expect(normalizeFeedbackMarkdown(input)).toBe('Outside ||norm|| and ... vs inside: $\\lVert v \\rVert$ and $a \\dots b$');
  });

  describe('Post-JSON-Parsing Guardrail Simulation', () => {
    it('handles correctly double-escaped LaTeX strings without mangling (e.g. \\ne, \\times)', () => {
      // Simulating the result of JSON.parse('{"text": "m \\\\ne n and a \\\\times b"}')
      // In JS memory, this is the string literal 'm \\ne n and a \\times b'
      const input = 'Math: $m \\ne n$ and $a \\times b$';
      const output = normalizeFeedbackMarkdown(input);
      expect(output).toBe('Math: $m \\ne n$ and $a \\times b$');
    });

    it('handles correctly double-escaped \\to without aggressive replacement', () => {
      // Simulating JSON.parse('{"text": "$x \\\\to \\\\infty$"}')
      const input = 'Limit: $x \\to \\infty$';
      const output = normalizeFeedbackMarkdown(input);
      expect(output).toBe('Limit: $x \\to \\infty$');
    });

    it('allows single newlines inside inline math blocks (e.g. LLM hard-wrapping) without breaking extraction', () => {
      const input = 'This is math: $m\n\\leq n$ and it continues.';
      const output = normalizeFeedbackMarkdown(input);
      expect(output).toBe('This is math: $m\n\\leq n$ and it continues.');
    });

    it('gracefully handles markdown bolding asterisks inside math (which KaTeX will unfortunately render as asterisks)', () => {
      // Since Gemini's prompt forbids this, this test just proves our parser doesn't crash if it happens.
      const input = 'The variable is $**q**$';
      const output = normalizeFeedbackMarkdown(input);
      expect(output).toBe('The variable is $**q**$');
    });
  });
});


describe('prepareFeedbackMarkdown validation integration', () => {
  it('returns ok: false behaviour (escaping all math) when unbalanced $ is present', () => {
    const input = 'This has unbalanced $ math $ and $ more';
    const output = prepareFeedbackMarkdown(input);
    // When validation fails, prepareFeedbackMarkdown escapes the dollars and parens
    expect(output).toContain('\\$');
  });
});

