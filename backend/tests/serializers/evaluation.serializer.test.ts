import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { serializeEvaluation } from '../../src/serializers/evaluation.serializer.js';

describe('serializeEvaluation (doc 8 §8.15, D-25)', () => {
  it('maps DB *Score columns to API scores keys (attempt 2)', () => {
    const createdAt = new Date('2026-04-01T00:00:00.000Z');
    const result = serializeEvaluation({
      feedback: 'Solid work',
      requirementsMetScore: 85,
      correctnessTestsScore: 90,
      codeQualityScore: 80,
      problemSolvingScore: 75,
      totalScore: new Prisma.Decimal('83.25'),
      createdAt,
    });

    expect(result).toEqual({
      feedback: 'Solid work',
      scores: {
        requirementsMet: 85,
        correctnessTests: 90,
        codeQuality: 80,
        problemSolving: 75,
        total: 83.25,
      },
      createdAt: createdAt.toISOString(),
    });
    expect(result).not.toHaveProperty('requirementsMetScore');
    expect(typeof result!.scores!.total).toBe('number');
  });

  it('returns scores: null for attempt-1 style null score columns', () => {
    const createdAt = new Date('2026-04-02T00:00:00.000Z');
    const result = serializeEvaluation({
      feedback: 'Fix the tests first',
      requirementsMetScore: null,
      correctnessTestsScore: null,
      codeQualityScore: null,
      problemSolvingScore: null,
      totalScore: null,
      createdAt,
    });

    expect(result).toEqual({
      feedback: 'Fix the tests first',
      scores: null,
      createdAt: createdAt.toISOString(),
    });
  });

  it('returns null when evaluation is absent', () => {
    expect(serializeEvaluation(null)).toBeNull();
  });
});
