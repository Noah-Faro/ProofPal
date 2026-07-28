import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LibraryBook {
  id: string;
  name: string;
  domain: string;
  subjectId?: string;
  uri: string;
  size?: number;
  addedAt: number;
  remotePdfName?: string;
  remotePdfTimestamp?: number;
}

export const LIBRARY_STORAGE_KEY = 'scribe_library';
export const LEGACY_LIBRARY_STORAGE_KEY = 'proofpal_library';

/**
 * Loads library books from AsyncStorage.
 * Backwards compatibility: If 'scribe_library' is missing, reads from legacy 'proofpal_library'
 * and migrates data seamlessly without data loss.
 */
export async function loadLibrary(): Promise<LibraryBook[]> {
  try {
    const data = await AsyncStorage.getItem(LIBRARY_STORAGE_KEY);
    if (data !== null) {
      return JSON.parse(data);
    }

    // Backwards compatibility migration check
    const legacyData = await AsyncStorage.getItem(LEGACY_LIBRARY_STORAGE_KEY);
    if (legacyData !== null) {
      const books: LibraryBook[] = JSON.parse(legacyData);
      await saveLibrary(books);
      return books;
    }

    return [];
  } catch (e) {
    console.error('Failed to load library books', e);
    return [];
  }
}

/**
 * Saves library books to AsyncStorage under canonical key 'scribe_library'.
 */
export async function saveLibrary(books: LibraryBook[]): Promise<void> {
  try {
    await AsyncStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(books));
  } catch (e) {
    console.error('Failed to save library books', e);
  }
}

/**
 * Updates a specific library book by ID with partial fields.
 */
export async function updateLibraryBook(id: string, updates: Partial<LibraryBook>): Promise<void> {
  try {
    const books = await loadLibrary();
    const index = books.findIndex(b => b.id === id);
    if (index !== -1) {
      books[index] = { ...books[index], ...updates };
      await saveLibrary(books);
    }
  } catch (e) {
    console.error('Failed to update library book', e);
  }
}
