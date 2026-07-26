import { MathSubject, SubjectCategory } from './types';

/**
 * List of all supported math subjects across categories.
 */
export const MATH_SUBJECTS: MathSubject[] = [
  // Foundations
  {
    id: 'logic-set-theory',
    name: 'Logic & Set Theory',
    category: SubjectCategory.FOUNDATIONS,
  },
  {
    id: 'discrete-mathematics',
    name: 'Discrete Mathematics',
    category: SubjectCategory.FOUNDATIONS,
  },

  // Analysis
  {
    id: 'real-analysis',
    name: 'Real Analysis',
    category: SubjectCategory.ANALYSIS,
  },
  {
    id: 'complex-analysis',
    name: 'Complex Analysis',
    category: SubjectCategory.ANALYSIS,
  },
  {
    id: 'functional-analysis',
    name: 'Functional Analysis',
    category: SubjectCategory.ANALYSIS,
  },
  {
    id: 'measure-theory',
    name: 'Measure Theory',
    category: SubjectCategory.ANALYSIS,
  },

  // Algebra
  {
    id: 'linear-algebra',
    name: 'Linear Algebra',
    category: SubjectCategory.ALGEBRA,
  },
  {
    id: 'abstract-algebra',
    name: 'Abstract Algebra',
    category: SubjectCategory.ALGEBRA,
  },
  {
    id: 'number-theory',
    name: 'Number Theory',
    category: SubjectCategory.ALGEBRA,
  },

  // Geometry & Topology
  {
    id: 'topology',
    name: 'Topology',
    category: SubjectCategory.GEOMETRY_TOPOLOGY,
  },
  {
    id: 'differential-geometry',
    name: 'Differential Geometry',
    category: SubjectCategory.GEOMETRY_TOPOLOGY,
  },
  {
    id: 'algebraic-geometry',
    name: 'Algebraic Geometry',
    category: SubjectCategory.GEOMETRY_TOPOLOGY,
  },

  // Applied
  {
    id: 'probability-theory',
    name: 'Probability Theory',
    category: SubjectCategory.APPLIED,
  },
  {
    id: 'statistics',
    name: 'Statistics',
    category: SubjectCategory.APPLIED,
  },
  {
    id: 'differential-equations',
    name: 'Differential Equations',
    category: SubjectCategory.APPLIED,
  },
  {
    id: 'numerical-analysis',
    name: 'Numerical Analysis',
    category: SubjectCategory.APPLIED,
  },

  // Other
  {
    id: 'combinatorics',
    name: 'Combinatorics',
    category: SubjectCategory.OTHER,
  },
  {
    id: 'graph-theory',
    name: 'Graph Theory',
    category: SubjectCategory.OTHER,
  },
  {
    id: 'category-theory',
    name: 'Category Theory',
    category: SubjectCategory.OTHER,
  },
];

/**
 * Returns subjects grouped by their category.
 */
export function getSubjectsByCategory(): Record<string, MathSubject[]> {
  return MATH_SUBJECTS.reduce((acc, subject) => {
    const cat = subject.category as string;
    if (!acc[cat]) {
      acc[cat] = [];
    }
    acc[cat].push(subject);
    return acc;
  }, {} as Record<string, MathSubject[]>);
}

/**
 * Returns a MathSubject by its unique slug ID, or undefined if not found.
 */
export function getSubjectById(id: string): MathSubject | undefined {
  return MATH_SUBJECTS.find((subject) => subject.id === id);
}
