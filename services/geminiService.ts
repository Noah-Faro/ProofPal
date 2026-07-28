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
const PDF_POLL_INTERVAL_MS = 4_000;

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
    if (request.exerciseContext?.coursePdf) {
      request.onStageChange?.('uploading-pdf');
      const pdf = request.exerciseContext.coursePdf;
      
      const EXPIRATION_THRESHOLD_MS = 47 * 60 * 60 * 1000;
      const isCachedAndValid = pdf.remoteName && pdf.remoteTimestamp && (Date.now() - pdf.remoteTimestamp < EXPIRATION_THRESHOLD_MS);

      if (isCachedAndValid) {
        remotePdfName = pdf.remoteName;
        parts.push(createPartFromUri(`https://generativelanguage.googleapis.com/v1beta/files/${pdf.remoteName}`, 'application/pdf'));
      } else {
        const uploadedPdf = await uploadAndProcessPdf(
          ai,
          pdf,
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
        ...(request.thinking && {
          thinkingConfig: {
            thinkingLevel: 'HIGH',
            includeThoughts: false,
          }
        } as any),
      },
    });

    return parseProofResult(response.text, request, remotePdfName);
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
    
    try {
      currentFile = await ai.files.get({
        name: uploadedFile.name!,
        config: {
          abortSignal: signal,
          httpOptions: { timeout: 15_000 },
        },
      });
    } catch (error) {
      if (isAbortError(error)) throw error;
      // If we get a 404, 503, or network error during polling, just ignore it and let the loop retry
      // until the overall PDF_PROCESSING_TIMEOUT_MS deadline is reached.
      console.warn('Transient error while polling PDF state, retrying...', error);
    }
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

function parseProofResult(responseText: string | undefined, request: ProofCheckRequest, remotePdfName?: string): ProofCheckResult {
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
      remotePdfName,
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

function toProofPalError(error: unknown, fallbackMessage = 'Scribe could not evaluate this proof. Please try again.'): ProofPalError {
  if (error instanceof ProofPalError) {
    return error;
  }
  if (isAbortError(error)) {
    return new ProofPalError('CANCELLED', 'Proof evaluation was cancelled.', false);
  }

  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('503') || message.includes('overloaded') || message.includes('busy')) {
    return new ProofPalError(
      'API',
      'This model is currently overloaded. Try again in a moment, or switch to Flash 3.6.',
      true,
      'retry',
      'gemini-3.6-flash',
    );
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return new ProofPalError('TIMEOUT', 'The request took too long. Check your connection and try again.', true, 'retry');
  }
  if (message.includes('429') || message.includes('resource_exhausted') || message.includes('rate limit') || message.includes('quota')) {
    return new ProofPalError(
      'RATE_LIMIT',
      "You've reached the free tier limit for this model. Try switching to Flash 3.6, or wait a few minutes.",
      true,
      'retry',
      'gemini-3.6-flash',
    );
  }
  if (message.includes('401') || message.includes('403') || message.includes('api key')) {
    return new ProofPalError('MISSING_API_KEY', 'Your Gemini API key was rejected. Add a valid key and retry.', false, 'add-api-key');
  }
  if (message.includes('404')) {
    if (message.includes('models/') || message.includes('model ')) {
      return new ProofPalError('MODEL_UNAVAILABLE', 'The selected Gemini model is unavailable. Choose another model.', false, 'open-settings');
    }
    // If it's a 404 for a file, it means it's not found (yet) or deleted.
    return new ProofPalError('FILE_EXPIRED', 'Scribe could not find the file or it hasn\'t synced yet. Please try again.', true, 'retry');
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return new ProofPalError('NETWORK', 'No internet connection. Check your network and try again.', true, 'retry');
  }
  return new ProofPalError('API', fallbackMessage, true, 'retry');
}

export async function sendFollowUpMessage(
  message: string,
  currentFeedback: string,
  previousChat: { role: 'user' | 'model'; text: string }[],
  config: { model: GeminiModel; depth: PedagogicalDepth; originalProofImage?: string },
  imageUri?: string,
  remotePdfName?: string
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
    
    const history: { role: 'user' | 'model'; parts: Part[] }[] = previousChat.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

    if (remotePdfName) {
      const pdfPart = createPartFromUri(
        remotePdfName.startsWith('http') ? remotePdfName : `https://generativelanguage.googleapis.com/v1beta/${remotePdfName.startsWith('files/') ? remotePdfName : 'files/' + remotePdfName}`,
        'application/pdf'
      );
      if (history.length > 0 && history[0].role === 'user') {
        history[0].parts.unshift(pdfPart);
      } else {
        history.unshift(
          { role: 'user', parts: [pdfPart, { text: 'Course textbook reference PDF attached.' }] },
          { role: 'model', parts: [{ text: 'Understood. I have access to the course textbook reference.' }] }
        );
      }
    }

    const systemInstruction = `You are a helpful pedagogical math assistant. The user is asking a follow-up question about their proof evaluation.
Current Feedback Provided to User:
${currentFeedback}
Pedagogical Depth: ${config.depth}${remotePdfName ? `\nReferenced Textbook File: ${remotePdfName}` : ''}`;

    const userParts: Part[] = [];
    if (message) {
      userParts.push({ text: message });
    }
    if (imageUri) {
      const prepared = await prepareImageForApi(imageUri);
      userParts.push({ inlineData: { data: prepared.data, mimeType: prepared.mimeType } });
    }

    // Include the ORIGINAL proof image in the first history message if it exists
    if (history.length > 0 && history[0].role === 'user' && config.originalProofImage) {
      const preparedOriginal = await prepareImageForApi(config.originalProofImage);
      history[0].parts.unshift({ inlineData: { data: preparedOriginal.data, mimeType: preparedOriginal.mimeType } });
    }

    const chat = ai.chats.create({
      model: config.model,
      config: {
        systemInstruction,
        httpOptions: { timeout: GENERATION_TIMEOUT_MS },
      },
      history: history as any, // Cast to any to bypass strict type-checking on Content role
    });

    const response = await chat.sendMessage({ message: userParts });

    if (!response.text) {
      throw new Error('Empty response');
    }

    return response.text;
  } catch (error) {
    throw toProofPalError(error);
  }
}
