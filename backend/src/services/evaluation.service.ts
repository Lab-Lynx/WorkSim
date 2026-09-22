import {
  calculateWeightedScore as calculateRubricWeightedScore,
  type RubricScores,
} from '../lib/scoring/rubric.js';

export function calculateWeightedScore(scores: RubricScores): number {
  return calculateRubricWeightedScore(scores);
}
