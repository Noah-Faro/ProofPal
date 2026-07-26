import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSubjectById } from '../models/subjects';
import { GeminiModel, AppSettings, PedagogicalDepth } from '../models/types';

export const SETTINGS_STORAGE_KEY = 'proofpal_settings';
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
  'gemini-3.1-pro': GeminiModel.PRO_31_PREVIEW,
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
    const stored = parseStoredSettings(await AsyncStorage.getItem(SETTINGS_STORAGE_KEY));
    const normalized = normalizeSettings(stored);

    if (settingsDiffer(stored, normalized)) {
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
    }

    return normalized;
  });
}

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
