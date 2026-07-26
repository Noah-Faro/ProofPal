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
  FLASH_25 = 'gemini-2.5-flash',
  PRO_25 = 'gemini-2.5-pro',
  FLASH_20 = 'gemini-2.0-flash',
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
 * Contextual details for an exercise (all optional).
 */
export interface ExerciseContext {
  reference?: string;        // e.g., 'Exercise 4.2b'
  sourceText?: string;       // typed/pasted exercise statement
  sourceImageUri?: string;   // photo of the exercise from textbook
}

/**
 * Full configuration for a proof check request sent to the AI.
 */
export interface ProofCheckRequest {
  proofImageBase64: string;
  depth: PedagogicalDepth;
  model: GeminiModel;
  subject?: MathSubject;
  exerciseContext?: ExerciseContext;
}

/**
 * The result of a proof check returned by the system.
 */
export interface ProofCheckResult {
  response: string;          // Raw markdown+LaTeX response from the AI
  model: GeminiModel;
  depth: PedagogicalDepth;
  timestamp: number;
  isCorrect?: boolean;       // Parsed from response if possible
}

/**
 * App settings persisted across user sessions.
 */
export interface AppSettings {
  selectedModel: GeminiModel;
  selectedDepth: PedagogicalDepth;
  selectedSubjectId?: string;
  hasCompletedOnboarding: boolean;
}
