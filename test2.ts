import { normalizeFeedbackMarkdown } from './components/MarkdownRenderer';
console.log(normalizeFeedbackMarkdown('n leqm'));
console.log(normalizeFeedbackMarkdown('$n leqm$'));
console.log(normalizeFeedbackMarkdown('$n le qm$'));
console.log(normalizeFeedbackMarkdown('$n leq m$'));
console.log(normalizeFeedbackMarkdown('$n \\leqm$'));
