import { GeminiModel, ModelInfo } from './types';

/**
 * Metadata and display configurations for supported Gemini AI models.
 */
export const GEMINI_MODELS: ModelInfo[] = [
  {
    model: GeminiModel.FLASH_20,
    label: 'Gemini 2.0 Flash',
    badge: '⚡ 2.0 Flash',
    description: 'Fast responses, generous limits. Best for most proofs.',
  },
  {
    model: GeminiModel.FLASH_15,
    label: 'Gemini 1.5 Flash',
    badge: '⚡ 1.5 Flash',
    description: 'Extremely fast and reliable for standard checks.',
  },
  {
    model: GeminiModel.PRO_15,
    label: 'Gemini 1.5 Pro',
    badge: '🧠 1.5 Pro',
    description: 'Deep reasoning for complex proofs. Higher quality analysis.',
  },
];

/**
 * Returns metadata for a given GeminiModel, or undefined if not found.
 */
export function getModelInfo(model: GeminiModel): ModelInfo | undefined {
  return GEMINI_MODELS.find((item) => item.model === model);
}
