import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSubjectById } from '../models/subjects';
import { GeminiModel, AppSettings, PedagogicalDepth, HistoryEntry, MathSubject } from '../models/types';
export { getApiScopeId, rotateApiScopeId, deleteApiScopeId } from '../services/secureStorage';


export const SETTINGS_STORAGE_KEY = 'scribe_settings';
export const SETTINGS_VERSION = 2;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  settingsVersion: SETTINGS_VERSION,
  selectedModel: GeminiModel.FLASH_36,
  selectedDepth: PedagogicalDepth.GUIDE,
  selectedSubjectId: undefined,
  hasCompletedOnboarding: false,
};

const LEGACY_MODEL_MIGRATIONS: Record<string, GeminiModel> = {
  'gemini-1.5-flash': GeminiModel.FLASH_36,
  'gemini-1.5-pro': GeminiModel.FLASH_36,
  'gemini-2.0-flash': GeminiModel.FLASH_36,
  'gemini-2.5-flash': GeminiModel.FLASH_36,
  'gemini-2.5-flash-lite': GeminiModel.FLASH_36,
  'gemini-2.5-pro': GeminiModel.FLASH_36,
  'gemini-3.1-pro': GeminiModel.PRO_31,
};

const VALID_MODELS = new Set<string>(Object.values(GeminiModel));
const VALID_DEPTHS = new Set<string>(Object.values(PedagogicalDepth));

type StoredSettings = Partial<Record<keyof AppSettings, unknown>>;

let writeTail: Promise<void> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeTail.then(operation, operation);
  writeTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export const HISTORY_KEY = 'scribe_history';
export const CUSTOM_SUBJECTS_KEY = 'scribe_custom_subjects';
export const CUSTOM_CATEGORIES_KEY = 'scribe_custom_categories';

/**
 * One-time migration function that checks if proofpal_settings exists.
 * If it does, copies data from all old proofpal_ keys to their scribe_ equivalents,
 * then removes the old keys.
 */
export async function migrateStorageKeys(): Promise<void> {
  try {
    const oldSettings = await AsyncStorage.getItem('proofpal_settings');
    if (oldSettings !== null) {
      const KEY_MIGRATIONS: [string, string][] = [
        ['proofpal_settings', SETTINGS_STORAGE_KEY],
        ['proofpal_history', HISTORY_KEY],
        ['proofpal_custom_subjects', CUSTOM_SUBJECTS_KEY],
        ['proofpal_custom_categories', CUSTOM_CATEGORIES_KEY],
        ['proofpal_library', 'scribe_library'],
      ];

      for (const [oldKey, newKey] of KEY_MIGRATIONS) {
        const val = await AsyncStorage.getItem(oldKey);
        if (val !== null) {
          await AsyncStorage.setItem(newKey, val);
          await AsyncStorage.removeItem(oldKey);
        }
      }
    }
  } catch (error) {
    console.error('Error migrating storage keys:', error);
  }
}

function parseStoredSettings(value: string | null): StoredSettings {
  if (!value) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as StoredSettings)
      : {};
  } catch {
    return {};
  }
}

function normalizeModel(value: unknown): GeminiModel {
  if (typeof value !== 'string') {
    return DEFAULT_APP_SETTINGS.selectedModel;
  }

  if (value in LEGACY_MODEL_MIGRATIONS) {
    return LEGACY_MODEL_MIGRATIONS[value];
  }

  if (
    value.startsWith('gemini-1.5-') ||
    value.startsWith('gemini-2.0-') ||
    value.startsWith('gemini-2.5-')
  ) {
    return GeminiModel.FLASH_36;
  }

  return VALID_MODELS.has(value)
    ? (value as GeminiModel)
    : DEFAULT_APP_SETTINGS.selectedModel;
}

function normalizeSettings(stored: StoredSettings): AppSettings {
  const selectedSubjectId =
    typeof stored.selectedSubjectId === 'string' && getSubjectById(stored.selectedSubjectId)
      ? stored.selectedSubjectId
      : undefined;

  return {
    settingsVersion: SETTINGS_VERSION,
    selectedModel: normalizeModel(stored.selectedModel),
    selectedDepth:
      typeof stored.selectedDepth === 'string' && VALID_DEPTHS.has(stored.selectedDepth)
        ? (stored.selectedDepth as PedagogicalDepth)
        : DEFAULT_APP_SETTINGS.selectedDepth,
    selectedSubjectId,
    hasCompletedOnboarding: stored.hasCompletedOnboarding === true,
  };
}

function settingsDiffer(stored: StoredSettings, normalized: AppSettings): boolean {
  return (
    stored.settingsVersion !== normalized.settingsVersion ||
    stored.selectedModel !== normalized.selectedModel ||
    stored.selectedDepth !== normalized.selectedDepth ||
    stored.selectedSubjectId !== normalized.selectedSubjectId ||
    stored.hasCompletedOnboarding !== normalized.hasCompletedOnboarding
  );
}

/**
 * Read, validate, and migrate persisted settings. Invalid fields are replaced with safe defaults.
 * Calls are ordered with writes so a load cannot observe an incomplete in-app update.
 */
export function loadAppSettings(): Promise<AppSettings> {
  return enqueue(async () => {
    await migrateStorageKeys();
    const stored = parseStoredSettings(await AsyncStorage.getItem(SETTINGS_STORAGE_KEY));
    const normalized = normalizeSettings(stored);

    if (settingsDiffer(stored, normalized)) {
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
    }

    return normalized;
  });
}

export const loadSettings = loadAppSettings;

/**
 * Merge a validated partial update with the latest persisted values in a serialized write queue.
 */
export function updateAppSettings(update: Partial<AppSettings>): Promise<AppSettings> {
  return enqueue(async () => {
    const current = normalizeSettings(
      parseStoredSettings(await AsyncStorage.getItem(SETTINGS_STORAGE_KEY)),
    );
    const next = normalizeSettings({ ...current, ...update });
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
    return next;
  });
}

/** Mark the app as needing API-key onboarding while preserving all user preferences. */
export function markOnboardingIncomplete(): Promise<AppSettings> {
  return updateAppSettings({ hasCompletedOnboarding: false });
}

const MAX_HISTORY_ENTRIES = 100;

export async function loadHistory(): Promise<HistoryEntry[]> {
  try {
    const json = await AsyncStorage.getItem(HISTORY_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function saveHistoryEntry(entry: HistoryEntry): Promise<void> {
  const history = await loadHistory();
  history.unshift(entry);
  if (history.length > MAX_HISTORY_ENTRIES) history.length = MAX_HISTORY_ENTRIES;
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export async function updateHistoryEntry(id: string, updates: Partial<HistoryEntry>): Promise<void> {
  const history = await loadHistory();
  const index = history.findIndex((entry) => entry.id === id);
  if (index !== -1) {
    history[index] = { ...history[index], ...updates };
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }
}


export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(HISTORY_KEY);
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const history = await loadHistory();
  const updated = history.filter(entry => entry.id !== id);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

export async function loadCustomSubjects(): Promise<MathSubject[]> {
  try {
    const json = await AsyncStorage.getItem(CUSTOM_SUBJECTS_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function addCustomSubject(subject: MathSubject): Promise<void> {
  const subjects = await loadCustomSubjects();
  subjects.push(subject);
  await AsyncStorage.setItem(CUSTOM_SUBJECTS_KEY, JSON.stringify(subjects));
}

export async function deleteCustomSubject(id: string): Promise<void> {
  const subjects = await loadCustomSubjects();
  const updated = subjects.filter((s) => s.id !== id);
  await AsyncStorage.setItem(CUSTOM_SUBJECTS_KEY, JSON.stringify(updated));
}

export async function loadCustomCategories(): Promise<string[]> {
  try {
    const json = await AsyncStorage.getItem(CUSTOM_CATEGORIES_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function addCustomCategory(category: string): Promise<void> {
  const categories = await loadCustomCategories();
  if (!categories.includes(category)) {
    categories.push(category);
    await AsyncStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(categories));
  }
}

export async function deleteCustomCategory(category: string): Promise<void> {
  const categories = await loadCustomCategories();
  const updatedCats = categories.filter((c) => c !== category);
  await AsyncStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(updatedCats));

  const subjects = await loadCustomSubjects();
  const updatedSubjs = subjects.filter((s) => s.category !== category);
  await AsyncStorage.setItem(CUSTOM_SUBJECTS_KEY, JSON.stringify(updatedSubjs));
}
