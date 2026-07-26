import { GeminiModel, ModelInfo } from './types';

/**
 * Metadata and display configurations for supported Gemini AI models.
 */
export const GEMINI_MODELS: ModelInfo[] = [
  {
    model: GeminiModel.FLASH_36,
    label: 'Gemini 3.6 Flash',
    badge: '⚡ 3.6 Flash',
    description: 'Blazing fast, state-of-the-art responses. Best for most proofs.',
  },
  {
    model: GeminiModel.PRO_31,
    label: 'Gemini 3.1 Pro',
    badge: '🧠 3.1 Pro',
    description: 'Deep reasoning for the most complex mathematical proofs.',
  },
  {
    model: GeminiModel.FLASH_20,
    label: 'Gemini 2.0 Flash',
    badge: '⚡ 2.0 Flash',
    description: 'Legacy fast model. Good for standard checks.',
  },
];

/**
 * Returns metadata for a given GeminiModel, or undefined if not found.
 */
export function getModelInfo(model: GeminiModel): ModelInfo | undefined {
  return GEMINI_MODELS.find((item) => item.model === model);
}
