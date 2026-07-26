import * as FileSystem from 'expo-file-system';

/**
 * Convert a local file URI or data URI to a raw base64 string.
 *
 * @param uri - The file URI or data URL to convert.
 * @returns A Promise that resolves to the base64-encoded image string.
 */
export async function uriToBase64(uri: string): Promise<string> {
  if (!uri) {
    throw new Error('Image URI is required');
  }

  // Handle data URIs if passed directly
  if (uri.startsWith('data:')) {
    const commaIndex = uri.indexOf(',');
    if (commaIndex !== -1) {
      return uri.substring(commaIndex + 1);
    }
  }

  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch (error) {
    console.error('Error reading image file as base64:', error);
    throw new Error(`Failed to read image at URI: ${uri}`);
  }
}

/**
 * Prepare an image for API submission (converts image URI to base64 format).
 *
 * @param uri - The local file URI of the image.
 * @returns A Promise that resolves to the base64 string prepared for API use.
 */
export async function prepareImageForApi(uri: string): Promise<string> {
  return uriToBase64(uri);
}
