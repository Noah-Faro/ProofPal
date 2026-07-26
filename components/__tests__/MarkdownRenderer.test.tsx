import { sanitizeFeedbackMarkdown } from '../MarkdownRenderer';

describe('sanitizeFeedbackMarkdown', () => {
  it('removes remote image directives while keeping text feedback', () => {
    expect(sanitizeFeedbackMarkdown('Keep this. ![tracker](https://example.com/pixel.png)')).toBe('Keep this. [Image omitted]');
  });
});
