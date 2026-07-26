import { DepthInfo, PedagogicalDepth } from './types';

/**
 * Metadata and theme information for pedagogical depth levels.
 */
export const DEPTH_LEVELS: DepthInfo[] = [
  {
    level: PedagogicalDepth.EXPLORE,
    label: 'Explore',
    icon: '🧭',
    description: 'Only tells you correct or incorrect. Maximum independence.',
    color: '#8b5cf6',
  },
  {
    level: PedagogicalDepth.NUDGE,
    label: 'Nudge',
    icon: '💡',
    description: 'Identifies the step and gives one gentle hint.',
    color: '#f59e0b',
  },
  {
    level: PedagogicalDepth.GUIDE,
    label: 'Guide',
    icon: '🗺️',
    description: 'Explains what the error is and why, but not the fix.',
    color: '#3b82f6',
  },
  {
    level: PedagogicalDepth.TEACH,
    label: 'Teach',
    icon: '📖',
    description: 'Full explanation with a mini-lesson on the concept.',
    color: '#22c55e',
  },
  {
    level: PedagogicalDepth.SOLVE,
    label: 'Solve',
    icon: '✅',
    description: 'Provides the complete corrected proof.',
    color: '#ef4444',
  },
];

/**
 * Returns display metadata for a specific pedagogical depth level.
 */
export function getDepthInfo(level: PedagogicalDepth): DepthInfo | undefined {
  return DEPTH_LEVELS.find((item) => item.level === level);
}
