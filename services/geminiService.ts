import { GoogleGenAI } from '@google/genai';
import { GeminiModel, ProofCheckRequest, ProofCheckResult, PedagogicalDepth } from '../models/types';
import { buildSystemPrompt, buildUserMessage } from './promptBuilder';
import { getApiKey } from './secureStorage';
import { uriToBase64 } from '../utilities/imageHelper';

/**
 * Helper function to clean base64 strings by removing data URI prefix if present.
 *
 * @param base64String - Raw base64 string or data URL.
 * @returns Clean base64 data string.
 */
function cleanBase64(base64String: string): string {
  if (base64String.startsWith('data:')) {
    const commaIndex = base64String.indexOf(',');
    if (commaIndex !== -1) {
      return base64String.substring(commaIndex + 1);
    }
  }
  return base64String;
}

/**
 * Validate a Gemini API key by making a lightweight test request.
 *
 * @param apiKey - The API key to test.
 * @returns A Promise resolving to true if valid, false otherwise.
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey || apiKey.trim().length === 0) {
    return false;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const response = await ai.models.generateContent({
      model: GeminiModel.FLASH_20,
      contents: 'Test connection',
    });
    return Boolean(response && response.text);
  } catch (error: any) {
    console.error('Gemini API key validation failed:', error);
    throw new Error(`Validation failed: ${error.message || String(error)}`);
  }
}

/**
 * Send proof image and contextual information to the Gemini API and return the evaluation result.
 *
 * @param request - Proof check request parameters including proof image, model, depth, and exercise context.
 * @returns A Promise resolving to a ProofCheckResult.
 * @throws Error if API key is not found or if the API call fails.
 */
export async function checkProof(request: ProofCheckRequest): Promise<ProofCheckResult> {
  const apiKey = await getApiKey();
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('Gemini API key not found. Please configure your API key in Settings.');
  }

  const systemPrompt = buildSystemPrompt({
    depth: request.depth,
    subject: request.subject,
    exerciseContext: request.exerciseContext,
  });

  const userMessage = buildUserMessage({
    exerciseContext: request.exerciseContext,
  });

  const parts: any[] = [
    { text: userMessage },
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: cleanBase64(request.proofImageBase64),
      },
    },
  ];

  if (request.exerciseContext?.sourceImageUri) {
    try {
      const exerciseImageBase64 = await uriToBase64(request.exerciseContext.sourceImageUri);
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanBase64(exerciseImageBase64),
        },
      });
    } catch (imageError) {
      console.warn('Failed to load exercise context image:', imageError);
    }
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

    const response = await ai.models.generateContent({
      model: request.model,
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      config: {
        systemInstruction: systemPrompt,
      }
    });

    const responseText = response.text;

    if (!responseText) {
      throw new Error('Empty response received from Gemini API.');
    }

    return {
      response: responseText,
      model: request.model,
      depth: request.depth,
      timestamp: Date.now(),
    };
  } catch (error: any) {
    console.error('Error in checkProof:', error);
    const message = error?.message || String(error);
    throw new Error(`Proof check failed: ${message}`);
  }
}
