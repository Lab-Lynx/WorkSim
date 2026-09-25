import type { Prisma } from '@prisma/client';

export type SerializeEvaluationInput = {
  feedback: string;
  requirementsMetScore: number | null;
  correctnessTestsScore: number | null;
  codeQualityScore: number | null;
  problemSolvingScore: number | null;
  totalScore: Prisma.Decimal | number | null;
  createdAt: Date;
} | null;

export type SerializedEvaluation = {
  feedback: string;
  scores: {
    requirementsMet: number;
    correctnessTests: number;
    codeQuality: number;
    problemSolving: number;
    total: number;
  } | null;
  createdAt: string;
} | null;

/**
 * Doc 5 Evaluation + D-25 rename: DB *Score/totalScore → API scores.* keys.
 * Attempt 1 (null score columns) → scores: null.
 */
export const serializeEvaluation = (
  evaluation: SerializeEvaluationInput,
): SerializedEvaluation => {
  if (!evaluation) return null;

  const scoresAreNull =
    evaluation.requirementsMetScore === null ||
    evaluation.correctnessTestsScore === null ||
    evaluation.codeQualityScore === null ||
    evaluation.problemSolvingScore === null ||
    evaluation.totalScore === null;

  return {
    feedback: evaluation.feedback,
    scores: scoresAreNull
      ? null
      : {
          requirementsMet: evaluation.requirementsMetScore as number,
          correctnessTests: evaluation.correctnessTestsScore as number,
          codeQuality: evaluation.codeQualityScore as number,
          problemSolving: evaluation.problemSolvingScore as number,
          total: Number(evaluation.totalScore),
        },
    createdAt: evaluation.createdAt.toISOString(),
  };
};
