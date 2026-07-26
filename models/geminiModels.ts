import { GeminiModel, ModelInfo } from './types';

/**
 * Metadata and display configurations for supported Gemini AI models.
 */
export const GEMINI_MODELS: ModelInfo[] = [
  {
    model: GeminiModel.FLASH_25,
    label: 'Gemini 2.5 Flash',
    badge: '⚡ Flash',
    description: 'Fast responses, generous free tier. Best for most proofs.',
  },
  {
    model: GeminiModel.PRO_25,
    label: 'Gemini 2.5 Pro',
    badge: '🧠 Pro',
    description: 'Deep reasoning for complex proofs. Slower, stricter limits.',
  },
  {
    model: GeminiModel.FLASH_20,
    label: 'Gemini 2.0 Flash',
    badge: '⚡⚡ Lite',
    description: 'Ultra-fast, very generous limits. Good for quick checks.',
  },
];

/**
 * Returns metadata for a given GeminiModel, or undefined if not found.
 */
export function getModelInfo(model: GeminiModel): ModelInfo | undefined {
  return GEMINI_MODELS.find((item) => item.model === model);
}
