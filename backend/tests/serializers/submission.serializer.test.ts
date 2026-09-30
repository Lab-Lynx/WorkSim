import { describe, expect, it } from 'vitest';
import { SubmissionStatus } from '@prisma/client';
import { serializeSubmission } from '../../src/serializers/submission.serializer.js';

const base = {
  id: 'sub-1',
  attempt: 1,
  status: SubmissionStatus.awaiting_ci,
  prNumber: 7,
  headSha: 'abc123',
  ciPassed: null,
  ciRunUrl: null,
  failureReason: null,
  submittedAt: new Date('2026-04-01T12:00:00.000Z'),
  evaluation: null,
  diff: 'diff --git a/foo',
};

describe('serializeSubmission (doc 8 §8.15)', () => {
  it('omits the diff key entirely when includeDiff is false', () => {
    const result = serializeSubmission(base, {
      includeDiff: false,
      repoFullName: 'ada/starter',
    });

    expect(result).not.toHaveProperty('diff');
    expect(result.prUrl).toBe('https://github.com/ada/starter/pull/7');
    expect(Object.keys(result).sort()).toEqual(
      [
        'attempt',
        'ciPassed',
        'ciRunUrl',
        'evaluation',
        'failureReason',
        'headSha',
        'id',
        'prNumber',
        'prUrl',
        'status',
        'submittedAt',
      ].sort(),
    );
  });

  it('includes diff when includeDiff is true', () => {
    const result = serializeSubmission(base, {
      includeDiff: true,
      repoFullName: 'ada/starter',
    });

    expect(result.diff).toBe('diff --git a/foo');
  });

  it('builds prUrl as https://github.com/{fullName}/pull/{prNumber}', () => {
    const result = serializeSubmission(
      { ...base, prNumber: 42 },
      { includeDiff: false, repoFullName: 'owner/name' },
    );
    expect(result.prUrl).toBe('https://github.com/owner/name/pull/42');
  });
});
