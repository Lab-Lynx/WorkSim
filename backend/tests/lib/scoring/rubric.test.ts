import {
  CODE_QUALITY_WEIGHT,
  CORRECTNESS_TESTS_WEIGHT,
  PROBLEM_SOLVING_WEIGHT,
  REQUIREMENTS_MET_WEIGHT,
  calculateWeightedScore,
} from '../../../src/lib/scoring/rubric.js';
import { calculateWeightedScore as calculateEvaluationWeightedScore } from '../../../src/services/evaluation.service.js';

describe('rubric', () => {
  it('exports the fixed rubric weights', () => {
    expect(REQUIREMENTS_MET_WEIGHT).toBe(0.4);
    expect(CORRECTNESS_TESTS_WEIGHT).toBe(0.25);
    expect(CODE_QUALITY_WEIGHT).toBe(0.2);
    expect(PROBLEM_SOLVING_WEIGHT).toBe(0.15);
  });

  it.each([
    [{ requirementsMet: 0, correctnessTests: 0, codeQuality: 0, problemSolving: 0 }, 0],
    [{ requirementsMet: 100, correctnessTests: 100, codeQuality: 100, problemSolving: 100 }, 100],
    [{ requirementsMet: 100, correctnessTests: 0, codeQuality: 0, problemSolving: 0 }, 40],
    [{ requirementsMet: 0, correctnessTests: 100, codeQuality: 0, problemSolving: 0 }, 25],
    [{ requirementsMet: 0, correctnessTests: 0, codeQuality: 100, problemSolving: 0 }, 20],
    [{ requirementsMet: 0, correctnessTests: 0, codeQuality: 0, problemSolving: 100 }, 15],
    [{ requirementsMet: 80, correctnessTests: 60, codeQuality: 70, problemSolving: 90 }, 74.5],
  ])('calculates a weighted total for %j', (scores, expected) => {
    expect(calculateWeightedScore(scores)).toBe(expected);
  });

  it('preserves decimal precision in the weighted total', () => {
    expect(
      calculateWeightedScore({
        requirementsMet: 33.33,
        correctnessTests: 66.67,
        codeQuality: 50,
        problemSolving: 50,
      }),
    ).toBeCloseTo(47.4995, 10);
  });

  it('uses the shared calculation from the evaluation service', () => {
    const scores = {
      requirementsMet: 80,
      correctnessTests: 60,
      codeQuality: 70,
      problemSolving: 90,
    };

    expect(calculateEvaluationWeightedScore(scores)).toBe(calculateWeightedScore(scores));
  });

  it.each([
    { requirementsMet: -1, correctnessTests: 50, codeQuality: 50, problemSolving: 50 },
    { requirementsMet: 101, correctnessTests: 50, codeQuality: 50, problemSolving: 50 },
    { requirementsMet: Number.NaN, correctnessTests: 50, codeQuality: 50, problemSolving: 50 },
    { requirementsMet: 50, correctnessTests: -1, codeQuality: 50, problemSolving: 50 },
    { requirementsMet: 50, correctnessTests: 101, codeQuality: 50, problemSolving: 50 },
    { requirementsMet: 50, correctnessTests: 50, codeQuality: -1, problemSolving: 50 },
    { requirementsMet: 50, correctnessTests: 50, codeQuality: 101, problemSolving: 50 },
    { requirementsMet: 50, correctnessTests: 50, codeQuality: 50, problemSolving: -1 },
    { requirementsMet: 50, correctnessTests: 50, codeQuality: 50, problemSolving: 101 },
    { requirementsMet: 50, correctnessTests: 50, codeQuality: 50, problemSolving: Number.NaN },
  ])('rejects invalid score inputs: %j', (scores) => {
    expect(() => calculateWeightedScore(scores)).toThrow();
  });
});
