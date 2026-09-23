import { describe, expect, it } from 'vitest';
import { RUBRIC_CATEGORIES } from '@/config/rubric';

describe('RUBRIC_CATEGORIES', () => {
  it('contains the fixed display rows in documented order', () => {
    expect(RUBRIC_CATEGORIES).toEqual([
      { key: 'requirementsMet', label: 'Requirements met', weightPercent: 40 },
      { key: 'correctnessTests', label: 'Correctness & tests', weightPercent: 25 },
      { key: 'codeQuality', label: 'Code quality', weightPercent: 20 },
      {
        key: 'problemSolving',
        label: 'Problem-solving & communication',
        weightPercent: 15,
      },
    ]);
  });

  it('has weights that sum to 100', () => {
    expect(RUBRIC_CATEGORIES.reduce((sum, category) => sum + category.weightPercent, 0)).toBe(100);
  });
});
