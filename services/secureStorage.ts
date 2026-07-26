import * as SecureStore from 'expo-secure-store';

const API_KEY_STORAGE_KEY = 'proofpal_gemini_api_key';

/**
 * Save the Gemini API key securely to the iOS Keychain / Android Keystore.
 *
 * @param apiKey - The Gemini API key string to save.
 * @returns A Promise that resolves when the API key is saved.
 */
export async function saveApiKey(apiKey: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, apiKey);
  } catch (error) {
    console.error('Error saving API key to SecureStore:', error);
    throw error;
  }
}

/**
 * Retrieve the stored Gemini API key, or null if not set or on error.
 *
 * @returns A Promise that resolves to the API key string or null.
 */
export async function getApiKey(): Promise<string | null> {
  try {
    const apiKey = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
    return apiKey ?? null;
  } catch (error) {
    console.error('Error retrieving API key from SecureStore:', error);
    return null;
  }
}

/**
 * Delete the stored Gemini API key from SecureStore.
 *
 * @returns A Promise that resolves when the API key is deleted.
 */
export async function deleteApiKey(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY);
  } catch (error) {
    console.error('Error deleting API key from SecureStore:', error);
    throw error;
  }
}

/**
 * Check if a Gemini API key is stored.
 *
 * @returns A Promise that resolves to true if an API key is present, false otherwise.
 */
export async function hasApiKey(): Promise<boolean> {
  try {
    const key = await getApiKey();
    return key !== null && key.trim().length > 0;
  } catch (error) {
    console.error('Error checking if API key exists:', error);
    return false;
  }
}
