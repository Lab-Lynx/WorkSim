import type { EvaluationScores } from '@/types';

export type ScoreKey = Exclude<keyof EvaluationScores, 'total'>;

export interface RubricCategory {
  key: ScoreKey;
  label: string;
  weightPercent: number;
}

export const RUBRIC_CATEGORIES: readonly RubricCategory[] = [
  { key: 'requirementsMet', label: 'Requirements met', weightPercent: 40 },
  { key: 'correctnessTests', label: 'Correctness & tests', weightPercent: 25 },
  { key: 'codeQuality', label: 'Code quality', weightPercent: 20 },
  {
    key: 'problemSolving',
    label: 'Problem-solving & communication',
    weightPercent: 15,
  },
];
