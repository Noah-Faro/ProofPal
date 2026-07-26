import {
  createPartFromUri,
  FileState,
  GoogleGenAI,
  type File as GeminiFile,
  type Part,
} from '@google/genai';
import * as ExpoFile from 'expo-file-system';
import { File as ExpoFileClass } from 'expo-file-system';
import { GeminiModel, PedagogicalDepth } from '../models/types';
import {
  type AppError,
  type LocalAttachment,
  type ProofCheckRequest,
  type ProofCheckResult,
  type ProofVerdict,
  ProofPalError,
  SUPPORTED_IMAGE_MIME_TYPES,
} from '../types/proof';
import { buildSystemPrompt, buildUserMessage } from './promptBuilder';
import { getApiKey } from './secureStorage';
import { MAX_INLINE_IMAGE_BYTES, prepareImageForApi } from '../utilities/imageHelper';

const MAX_PDF_BYTES = 50 * 1024 * 1024;
// Gemini inline requests have a 20 MB total limit. This leaves room for
// Base64 expansion, instructions, and the structured response schema.
const MAX_COMBINED_INLINE_IMAGE_BYTES = 13 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 60_000;
const GENERATION_TIMEOUT_MS = 90_000;
const PDF_PROCESSING_TIMEOUT_MS = 120_000;
const PDF_POLL_INTERVAL_MS = 2_000;
const PDF_POLL_RETRY_DELAYS_MS = [1_000, 2_000] as const;

const PROOF_RESULT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    verdict: {
      type: 'STRING',
      enum: ['correct', 'incorrect', 'incomplete', 'unreadable'],
    },
    feedbackMarkdown: {
      type: 'STRING',
      description: 'Student-facing mathematical feedback in Markdown with LaTeX.',
    },
  },
  required: ['verdict', 'feedbackMarkdown'],
  propertyOrdering: ['verdict', 'feedbackMarkdown'],
} as const;

/**
 * Validate a Gemini API key by making a lightweight request.
 */
export async function validateApiKey(apiKey: string, signal?: AbortSignal): Promise<boolean> {
  if (!apiKey?.trim()) {
    return false;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const response = await ai.models.generateContent({
      model: GeminiModel.FLASH_36,
      contents: 'Reply with OK.',
      config: {
        abortSignal: signal,
        httpOptions: { timeout: 20_000 },
      },
    });
    return Boolean(response.text);
  } catch (error) {
    throw toProofPalError(error);
  }
}

/**
 * Evaluates one proof snapshot. The caller owns its AbortController and must
 * discard the result when a newer request supersedes it.
 */
export async function checkProof(request: ProofCheckRequest): Promise<ProofCheckResult> {
  assertNotAborted(request.signal);
  request.onStageChange?.('preparing');
  assertPreparedImage(request.proofImage);

  const apiKey = await getApiKey();
  if (!apiKey?.trim()) {
    throw new ProofPalError(
      'MISSING_API_KEY',
      'Add your Gemini API key before checking a proof.',
      false,
      'add-api-key',
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const parts: Part[] = [
      { text: buildUserMessage({ exerciseContext: request.exerciseContext }) },
      { inlineData: request.proofImage },
    ];

    if (request.exerciseContext?.sourceImage) {
      // This is deliberately not best-effort: the prompt must never claim an
      // attachment was supplied when it could not be read.
      const sourceImage = await prepareImageForApi(request.exerciseContext.sourceImage);
      parts.push({ inlineData: sourceImage });
    }
    assertCombinedInlineImageSize(parts);

    let remotePdfName: string | undefined;
    try {
      if (request.exerciseContext?.coursePdf) {
        request.onStageChange?.('uploading-pdf');
        const uploadedPdf = await uploadAndProcessPdf(
          ai,
          request.exerciseContext.coursePdf,
          request.signal,
          (name) => {
            remotePdfName = name;
          },
          () => request.onStageChange?.('processing-pdf'),
        );
        if (!uploadedPdf.uri || !uploadedPdf.mimeType) {
          throw new ProofPalError('PDF_PROCESSING_FAILED', 'The uploaded PDF could not be used.', true, 'retry');
        }
        parts.push(createPartFromUri(uploadedPdf.uri, uploadedPdf.mimeType));
      }

      request.onStageChange?.('evaluating');
      const response = await ai.models.generateContent({
        model: request.model,
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction: buildSystemPrompt({ depth: request.depth, subject: request.subject, concise: request.concise, thinking: request.thinking }),
          responseMimeType: 'application/json',
          responseSchema: PROOF_RESULT_SCHEMA,
          abortSignal: request.signal,
          httpOptions: { timeout: GENERATION_TIMEOUT_MS },
        },
      });

      return parseProofResult(response.text, request);
    } finally {
      if (remotePdfName) {
        await deleteRemotePdf(ai, remotePdfName);
      }
    }
  } catch (error) {
    throw toProofPalError(error);
  }
}

async function uploadAndProcessPdf(
  ai: GoogleGenAI,
  attachment: LocalAttachment,
  signal: AbortSignal | undefined,
  onUploaded: (name: string) => void,
  onProcessing: () => void,
): Promise<GeminiFile> {
  assertPdfAttachment(attachment);
  assertNotAborted(signal);

  const localFile = new ExpoFileClass(attachment.uri);
  const fileSize = attachment.size ?? localFile.size;
  if (fileSize > MAX_PDF_BYTES) {
    throw new ProofPalError('FILE_TOO_LARGE', 'Course PDFs must be 50 MB or smaller.', false);
  }

  let uploadedFile: GeminiFile;
  try {
    uploadedFile = await ai.files.upload({
      file: localFile,
      config: {
        mimeType: 'application/pdf',
        displayName: attachment.name,
        abortSignal: signal,
        httpOptions: { timeout: UPLOAD_TIMEOUT_MS },
      },
    });
  } catch (error) {
    throw toProofPalError(error, 'Could not upload the course PDF.');
  }

  if (!uploadedFile.name) {
    throw new ProofPalError('PDF_PROCESSING_FAILED', 'The course PDF upload did not return a file identifier.', true, 'retry');
  }

  onUploaded(uploadedFile.name);
  onProcessing();
  return pollUntilPdfActive(ai, uploadedFile, signal);
}

async function pollUntilPdfActive(
  ai: GoogleGenAI,
  uploadedFile: GeminiFile,
  signal?: AbortSignal,
): Promise<GeminiFile> {
  const deadline = Date.now() + PDF_PROCESSING_TIMEOUT_MS;
  let currentFile = uploadedFile;

  while (true) {
    assertNotAborted(signal);
    if (currentFile.state === FileState.ACTIVE) {
      return currentFile;
    }
    if (currentFile.state === FileState.FAILED) {
      throw new ProofPalError(
        'PDF_PROCESSING_FAILED',
        'Gemini could not process this PDF. Try a different or smaller document.',
        true,
        'retry',
      );
    }
    if (Date.now() >= deadline) {
      throw new ProofPalError('TIMEOUT', 'The course PDF took too long to process. Please try again.', true, 'retry');
    }

    await sleep(PDF_POLL_INTERVAL_MS, signal);
    currentFile = await getFileWithRetry(ai, uploadedFile.name!, signal);
  }
}

async function getFileWithRetry(ai: GoogleGenAI, name: string, signal?: AbortSignal): Promise<GeminiFile> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= PDF_POLL_RETRY_DELAYS_MS.length; attempt += 1) {
    assertNotAborted(signal);
    try {
      return await ai.files.get({
        name,
        config: {
          abortSignal: signal,
          httpOptions: { timeout: 15_000 },
        },
      });
    } catch (error) {
      lastError = error;
      if (attempt === PDF_POLL_RETRY_DELAYS_MS.length || isAbortError(error)) {
        break;
      }
      await sleep(PDF_POLL_RETRY_DELAYS_MS[attempt], signal);
    }
  }
  throw toProofPalError(lastError, 'Could not check whether the course PDF finished processing.');
}

async function deleteRemotePdf(ai: GoogleGenAI, name: string): Promise<void> {
  try {
    await ai.files.delete({
      name,
      config: { httpOptions: { timeout: 10_000 } },
    });
  } catch {
    // Gemini expires Files automatically. Cleanup should never replace a
    // successful proof evaluation with an unrelated delete failure.
  }
}

function assertPdfAttachment(attachment: LocalAttachment): void {
  if (!attachment.uri || !attachment.name || attachment.mimeType.toLowerCase() !== 'application/pdf') {
    throw new ProofPalError('UNSUPPORTED_FILE', 'Choose one PDF course document.', false);
  }
}

function assertPreparedImage(image: ProofCheckRequest['proofImage']): void {
  if (!image.data || !SUPPORTED_IMAGE_MIME_TYPES.includes(image.mimeType)) {
    throw new ProofPalError('UNSUPPORTED_FILE', 'Use a JPEG, PNG, WebP, HEIC, or HEIF proof image.', false);
  }
  const padding = image.data.endsWith('==') ? 2 : image.data.endsWith('=') ? 1 : 0;
  const sizeBytes = Math.floor((image.data.length * 3) / 4) - padding;
  if (sizeBytes > MAX_INLINE_IMAGE_BYTES) {
    throw new ProofPalError('FILE_TOO_LARGE', 'This image is too large to evaluate. Choose an image smaller than 14 MB.', false);
  }
}

function assertCombinedInlineImageSize(parts: Part[]): void {
  const totalBytes = parts.reduce((total, part) => {
    const inlineData = part.inlineData;
    if (!inlineData?.data) {
      return total;
    }
    const padding = inlineData.data.endsWith('==') ? 2 : inlineData.data.endsWith('=') ? 1 : 0;
    return total + Math.floor((inlineData.data.length * 3) / 4) - padding;
  }, 0);

  if (totalBytes > MAX_COMBINED_INLINE_IMAGE_BYTES) {
    throw new ProofPalError(
      'FILE_TOO_LARGE',
      'The proof and context images are too large together. Choose smaller images and try again.',
      false,
    );
  }
}

function parseProofResult(responseText: string | undefined, request: ProofCheckRequest): ProofCheckResult {
  if (!responseText) {
    throw new ProofPalError('INVALID_RESPONSE', 'Gemini returned an empty proof evaluation. Please retry.', true, 'retry');
  }

  try {
    const parsed: unknown = JSON.parse(responseText);
    if (!isProofResultPayload(parsed)) {
      throw new Error('Invalid proof result payload');
    }
    return {
      ...parsed,
      model: request.model,
      depth: request.depth,
      timestamp: Date.now(),
    };
  } catch {
    throw new ProofPalError('INVALID_RESPONSE', 'Gemini returned an invalid proof evaluation. Please retry.', true, 'retry');
  }
}

function isProofResultPayload(value: unknown): value is Pick<ProofCheckResult, 'verdict' | 'feedbackMarkdown'> {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { verdict?: unknown; feedbackMarkdown?: unknown };
  return (
    typeof candidate.feedbackMarkdown === 'string'
    && candidate.feedbackMarkdown.trim().length > 0
    && (['correct', 'incorrect', 'incomplete', 'unreadable'] as ProofVerdict[]).includes(candidate.verdict as ProofVerdict)
  );
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new ProofPalError('CANCELLED', 'Proof evaluation was cancelled.', false);
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ProofPalError('CANCELLED', 'Proof evaluation was cancelled.', false));
      return;
    }
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timeout);
      reject(new ProofPalError('CANCELLED', 'Proof evaluation was cancelled.', false));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof ProofPalError && error.code === 'CANCELLED'
    || (error instanceof Error && error.name === 'AbortError');
}

export function toAppError(error: unknown): AppError {
  return toProofPalError(error);
}

function toProofPalError(error: unknown, fallbackMessage = 'ProofPal could not evaluate this proof. Please try again.'): ProofPalError {
  if (error instanceof ProofPalError) {
    return error;
  }
  if (isAbortError(error)) {
    return new ProofPalError('CANCELLED', 'Proof evaluation was cancelled.', false);
  }

  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('503') || message.includes('overloaded') || message.includes('busy')) {
    return new ProofPalError('API_ERROR' as any, 'Gemini is currently busy. Please try again in a moment.', true, 'retry');
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return new ProofPalError('TIMEOUT', 'The request took too long. Check your connection and try again.', true, 'retry');
  }
  if (message.includes('429') || message.includes('resource_exhausted') || message.includes('rate limit') || message.includes('quota')) {
    // Try to extract specific quota details
    let rateLimitMsg = 'You have exceeded your Gemini API rate limit.';
    if (message.includes('generatecontentfree_tier_requests') || message.includes('requests')) {
      rateLimitMsg = 'You have hit your request limit for this model. Try switching to a different model, or wait and try again later.';
    } else if (message.includes('generatecontentfree_tier_input_token_count') || message.includes('token')) {
      rateLimitMsg = 'You have exceeded the token input limit for this model. Try a shorter prompt or switch models.';
    }
    return new ProofPalError('RATE_LIMIT', rateLimitMsg, true, 'retry');
  }
  if (message.includes('401') || message.includes('403') || message.includes('api key')) {
    return new ProofPalError('MISSING_API_KEY', 'Your Gemini API key was rejected. Add a valid key and retry.', false, 'add-api-key');
  }
  if (message.includes('404') || message.includes('model')) {
    return new ProofPalError('MODEL_UNAVAILABLE', 'The selected Gemini model is unavailable. Choose another model.', false, 'open-settings');
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return new ProofPalError('NETWORK', 'ProofPal could not reach Gemini. Check your internet connection and retry.', true, 'retry');
  }
  return new ProofPalError('API', fallbackMessage, true, 'retry');
}

export async function sendFollowUpMessage(
  message: string,
  currentFeedback: string,
  previousChat: { role: 'user' | 'model'; text: string }[],
  config: { model: GeminiModel; depth: PedagogicalDepth },
  imageUri?: string
): Promise<string> {
  const apiKey = await getApiKey();
  if (!apiKey?.trim()) {
    throw new ProofPalError(
      'MISSING_API_KEY' as any,
      'Add your Gemini API key before checking a proof.',
      false,
      'add-api-key'
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    
    const history = previousChat.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

    const systemInstruction = `You are a helpful pedagogical math assistant. The user is asking a follow-up question about their proof evaluation.
Current Feedback Provided to User:
${currentFeedback}
Pedagogical Depth: ${config.depth}`;

    const userParts: Part[] = [];
    if (message) {
      userParts.push({ text: message });
    }
    if (imageUri) {
      const base64 = await ExpoFile.readAsStringAsync(imageUri, { encoding: 'base64' });
      userParts.push({ inlineData: { data: base64, mimeType: 'image/jpeg' } });
    }

    const contents = [
      ...history,
      { role: 'user', parts: userParts }
    ];

    const response = await ai.models.generateContent({
      model: config.model,
      contents,
      config: {
        systemInstruction,
        httpOptions: { timeout: GENERATION_TIMEOUT_MS },
      },
    });

    if (!response.text) {
      throw new Error('Empty response');
    }

    return response.text;
  } catch (error) {
    throw toProofPalError(error);
  }
}
