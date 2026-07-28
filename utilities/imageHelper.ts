import { File } from 'expo-file-system';
import {
  type LocalAttachment,
  type PreparedImage,
  ProofPalError,
  SUPPORTED_IMAGE_MIME_TYPES,
  type SupportedImageMime,
} from '../types/proof';

export const MAX_INLINE_IMAGE_BYTES = 14 * 1024 * 1024;

const DATA_URI_PATTERN = /^data:(image\/(?:jpeg|png|webp|heic|heif));base64,([A-Za-z0-9+/]+={0,2})$/i;

function normaliseMimeType(mimeType: string | undefined): string | undefined {
  return mimeType?.trim().toLowerCase();
}

function inferImageMimeType(uri: string): string | undefined {
  const extension = uri.split('?')[0]?.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    default:
      return undefined;
  }
}

function assertSupportedImageMimeType(mimeType: string | undefined): SupportedImageMime {
  if (SUPPORTED_IMAGE_MIME_TYPES.includes(mimeType as SupportedImageMime)) {
    return mimeType as SupportedImageMime;
  }

  throw new ProofPalError(
    'UNSUPPORTED_FILE',
    'Use a JPEG, PNG, WebP, HEIC, or HEIF image.',
    false,
  );
}

function base64ByteLength(data: string): number {
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return Math.floor((data.length * 3) / 4) - padding;
}

function assertImageSize(data: string): void {
  if (base64ByteLength(data) > MAX_INLINE_IMAGE_BYTES) {
    throw new ProofPalError(
      'FILE_TOO_LARGE',
      'This image is too large to evaluate. Choose an image smaller than 14 MB.',
      false,
    );
  }
}

/**
 * Convert a local file URI or data URI to a raw base64 string.
 *
 * @param uri - The file URI or data URL to convert.
 * @returns A Promise that resolves to the base64-encoded image string.
 */
export async function uriToBase64(uri: string): Promise<string> {
  if (!uri) {
    throw new ProofPalError('IMAGE_READ_FAILED', 'Choose an image before checking the proof.', false);
  }

  const dataUriMatch = uri.match(DATA_URI_PATTERN);
  if (dataUriMatch) {
    return dataUriMatch[2];
  }

  if (uri.startsWith('data:')) {
    throw new ProofPalError('UNSUPPORTED_FILE', 'The selected image data is invalid or unsupported.', false);
  }

  try {
    return await new File(uri).base64();
  } catch {
    throw new ProofPalError(
      'IMAGE_READ_FAILED',
      'Scribe could not read this image. Please choose it again and retry.',
      true,
      'retry',
    );
  }
}

/**
 * Prepare an image for API submission while preserving its verified MIME type.
 *
 * @param attachment - A picked image attachment or a legacy local URI.
 * @returns A Promise that resolves to Gemini inline image data.
 */
export async function prepareImageForApi(attachment: LocalAttachment | string): Promise<PreparedImage> {
  const localAttachment: LocalAttachment = typeof attachment === 'string'
    ? { uri: attachment, name: 'image', mimeType: inferImageMimeType(attachment) ?? '' }
    : attachment;
  const dataUriMatch = localAttachment.uri.match(DATA_URI_PATTERN);
  const mimeType = assertSupportedImageMimeType(
    normaliseMimeType(dataUriMatch?.[1] ?? localAttachment.mimeType) ?? inferImageMimeType(localAttachment.uri),
  );

  if (localAttachment.size !== undefined && localAttachment.size > MAX_INLINE_IMAGE_BYTES) {
    throw new ProofPalError(
      'FILE_TOO_LARGE',
      'This image is too large to evaluate. Choose an image smaller than 14 MB.',
      false,
    );
  }

  const data = await uriToBase64(localAttachment.uri);
  assertImageSize(data);
  return { data, mimeType };
}
