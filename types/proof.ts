import type { GeminiModel, MathSubject, PedagogicalDepth } from '../models/types';

export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export type SupportedImageMime = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

export interface LocalAttachment {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

export interface PreparedImage {
  data: string;
  mimeType: SupportedImageMime;
}

export interface ProofExerciseContext {
  reference?: string;
  sourceText?: string;
  sourceImage?: LocalAttachment;
  coursePdf?: LocalAttachment;
}

export type ProofVerdict = 'correct' | 'incorrect' | 'incomplete' | 'unreadable';

export type ProofCheckStage =
  | 'preparing'
  | 'uploading-pdf'
  | 'processing-pdf'
  | 'evaluating';

export interface ProofCheckRequest {
  proofImage: PreparedImage;
  depth: PedagogicalDepth;
  model: GeminiModel;
  subject?: MathSubject;
  exerciseContext?: ProofExerciseContext;
  signal?: AbortSignal;
  concise?: boolean;
  thinking?: boolean;
  onStageChange?: (stage: ProofCheckStage) => void;
}

export interface ProofCheckResult {
  verdict: ProofVerdict;
  feedbackMarkdown: string;
  model: GeminiModel;
  depth: PedagogicalDepth;
  timestamp: number;
}

export type AppErrorCode =
  | 'MISSING_API_KEY'
  | 'UNSUPPORTED_FILE'
  | 'FILE_TOO_LARGE'
  | 'IMAGE_READ_FAILED'
  | 'PDF_PROCESSING_FAILED'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'MODEL_UNAVAILABLE'
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'INVALID_RESPONSE'
  | 'API';

export interface AppError {
  code: AppErrorCode;
  message: string;
  retryable: boolean;
  recoveryAction?: 'retry' | 'add-api-key' | 'open-settings';
}

export class ProofPalError extends Error implements AppError {
  readonly name = 'ProofPalError';

  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly recoveryAction?: AppError['recoveryAction'],
  ) {
    super(message);
  }
}
