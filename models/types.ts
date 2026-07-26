/**
 * Pedagogical depth levels — controls how much help the AI gives.
 */
export enum PedagogicalDepth {
  /** Level 1: Only correct/incorrect, no hints */
  EXPLORE = 'explore',
  /** Level 2: Identifies step + one directional hint */
  NUDGE = 'nudge',
  /** Level 3: Explains what and why, but not the fix */
  GUIDE = 'guide',
  /** Level 4: Full explanation + mini-lesson */
  TEACH = 'teach',
  /** Level 5: Complete corrected proof */
  SOLVE = 'solve',
}

/**
 * Display metadata for each depth level.
 */
export interface DepthInfo {
  level: PedagogicalDepth;
  label: string;
  icon: string; // emoji
  description: string;
  color: string; // from theme
}

/**
 * Available Gemini models.
 */
export enum GeminiModel {
  FLASH_36 = 'gemini-3.6-flash',
  PRO_31_PREVIEW = 'gemini-3.1-pro-preview',
  FLASH_35_LITE = 'gemini-3.5-flash-lite',
}

/**
 * Display metadata for each model.
 */
export interface ModelInfo {
  model: GeminiModel;
  label: string;
  badge: string; // short display text like '⚡ Flash'
  description: string;
}

/**
 * Math subject categories.
 */
export enum SubjectCategory {
  FOUNDATIONS = 'Foundations',
  ANALYSIS = 'Analysis',
  ALGEBRA = 'Algebra',
  GEOMETRY_TOPOLOGY = 'Geometry & Topology',
  APPLIED = 'Applied',
  OTHER = 'Other',
}

/**
 * Represents a math subject.
 */
export interface MathSubject {
  id: string;
  name: string;
  category: SubjectCategory;
}

/**
 * App settings persisted across user sessions.
 */
export interface AppSettings {
  /** Increment when the serialized settings shape or normalization rules change. */
  settingsVersion: number;
  selectedModel: GeminiModel;
  selectedDepth: PedagogicalDepth;
  selectedSubjectId?: string;
  hasCompletedOnboarding: boolean;
}
