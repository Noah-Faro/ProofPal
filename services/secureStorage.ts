import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const API_KEY_STORAGE_KEY = 'proofpal_gemini_api_key';
const API_SCOPE_STORAGE_KEY = 'proofpal_api_scope';

/**
 * Retrieve the current API scope ID, or null if not set or on error.
 */
export async function getApiScopeId(): Promise<string | null> {
  try {
    const scopeId = await SecureStore.getItemAsync(API_SCOPE_STORAGE_KEY);
    return scopeId ?? null;
  } catch (error) {
    console.error('Error retrieving API scope ID from SecureStore:', error);
    return null;
  }
}

/**
 * Save the Gemini API key securely to the iOS Keychain / Android Keystore
 * and generate a new opaque API scope ID (UUID).
 *
 * @param apiKey - The Gemini API key string to save.
 * @returns A Promise that resolves to the new API scope ID.
 */
export async function saveApiKey(apiKey: string): Promise<string> {
  try {
    const scopeId = Crypto.randomUUID();
    await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, apiKey);
    await SecureStore.setItemAsync(API_SCOPE_STORAGE_KEY, scopeId);
    return scopeId;
  } catch (error) {
    console.error('Error saving API key and scope ID to SecureStore:', error);
    throw error;
  }
}

/**
 * Rotates the API scope ID by generating and saving a new UUID.
 *
 * @returns A Promise that resolves to the new API scope ID.
 */
export async function rotateApiScopeId(): Promise<string> {
  try {
    const scopeId = Crypto.randomUUID();
    await SecureStore.setItemAsync(API_SCOPE_STORAGE_KEY, scopeId);
    return scopeId;
  } catch (error) {
    console.error('Error rotating API scope ID in SecureStore:', error);
    throw error;
  }
}

/**
 * Delete the API scope ID from SecureStore.
 */
export async function deleteApiScopeId(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(API_SCOPE_STORAGE_KEY);
  } catch (error) {
    console.error('Error deleting API scope ID from SecureStore:', error);
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
    await deleteApiScopeId();
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

