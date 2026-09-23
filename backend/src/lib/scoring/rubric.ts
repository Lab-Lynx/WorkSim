export const RUBRIC_WEIGHTS = Object.freeze({
  requirementsMet: 0.4,
  correctnessTests: 0.25,
  codeQuality: 0.2,
  problemSolving: 0.15,
});

export const REQUIREMENTS_MET_WEIGHT = RUBRIC_WEIGHTS.requirementsMet;
export const CORRECTNESS_TESTS_WEIGHT = RUBRIC_WEIGHTS.correctnessTests;
export const CODE_QUALITY_WEIGHT = RUBRIC_WEIGHTS.codeQuality;
export const PROBLEM_SOLVING_WEIGHT = RUBRIC_WEIGHTS.problemSolving;

export type RubricScores = {
  requirementsMet: number;
  correctnessTests: number;
  codeQuality: number;
  problemSolving: number;
};

export function calculateWeightedScore(scores: RubricScores): number {
  for (const score of Object.values(scores)) {
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      throw new RangeError('Rubric scores must be finite numbers between 0 and 100');
    }
  }

  return (
    scores.requirementsMet * REQUIREMENTS_MET_WEIGHT +
    scores.correctnessTests * CORRECTNESS_TESTS_WEIGHT +
    scores.codeQuality * CODE_QUALITY_WEIGHT +
    scores.problemSolving * PROBLEM_SOLVING_WEIGHT
  );
}
