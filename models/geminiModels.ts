import { GeminiModel, ModelInfo } from './types';

/** Metadata and display configurations for supported Gemini AI models. */
export const GEMINI_MODELS: ModelInfo[] = [
  {
    model: GeminiModel.FLASH_36,
    label: 'Gemini 3.6 Flash',
    badge: '3.6 Flash',
    description: 'Fast, high-quality responses. Best for most proofs.',
  },
  {
    model: GeminiModel.PRO_31_PREVIEW,
    label: 'Gemini 3.1 Pro Preview',
    badge: 'Pro Preview',
    description: 'Highest-quality, paid preview model for complex proofs.',
  },
  {
    model: GeminiModel.FLASH_35_LITE,
    label: 'Gemini 3.5 Flash-Lite',
    badge: '3.5 Flash-Lite',
    description: 'Economical model for routine proof checks.',
  },
];

/** Returns metadata for a given Gemini model, if it is available. */
export function getModelInfo(model: GeminiModel): ModelInfo | undefined {
  return GEMINI_MODELS.find((item) => item.model === model);
}
