import { describe, expect, it } from 'vitest';
import {
  getSubmissionSchema,
  retrySubmissionParamsSchema,
  submitParamsSchema,
} from '../../src/validators/submission.validators.js';

const validId = '11111111-1111-4111-8111-111111111111';

describe('submission.validators (doc 7 §7.2.4)', () => {
  it('submitParamsSchema accepts a UUID ticketId', async () => {
    const parsed = await submitParamsSchema.parseAsync({
      params: { ticketId: validId },
    });
    expect(parsed.params.ticketId).toBe(validId);
  });

  it('submitParamsSchema rejects a non-UUID ticketId', async () => {
    await expect(
      submitParamsSchema.parseAsync({ params: { ticketId: 'not-a-uuid' } }),
    ).rejects.toBeTruthy();
  });

  it('getSubmissionSchema accepts attempt 1 and 2 as numbers', async () => {
    for (const attempt of ['1', '2'] as const) {
      const parsed = await getSubmissionSchema.parseAsync({
        params: { ticketId: validId, attempt },
        query: {},
      });
      expect(parsed.params.attempt).toBe(Number(attempt));
      expect(parsed.query.includeDiff).toBe(false);
    }
  });

  it.each(['0', '3', 'abc', '1.5'] as const)(
    'getSubmissionSchema rejects attempt %s',
    async (attempt) => {
      await expect(
        getSubmissionSchema.parseAsync({
          params: { ticketId: validId, attempt },
          query: {},
        }),
      ).rejects.toBeTruthy();
    },
  );

  it('includeDiff accepts true/false and rejects maybe', async () => {
    const t = await getSubmissionSchema.parseAsync({
      params: { ticketId: validId, attempt: '1' },
      query: { includeDiff: 'true' },
    });
    expect(t.query.includeDiff).toBe(true);

    const f = await getSubmissionSchema.parseAsync({
      params: { ticketId: validId, attempt: '1' },
      query: { includeDiff: 'false' },
    });
    expect(f.query.includeDiff).toBe(false);

    await expect(
      getSubmissionSchema.parseAsync({
        params: { ticketId: validId, attempt: '1' },
        query: { includeDiff: 'maybe' },
      }),
    ).rejects.toBeTruthy();
  });

  it('retrySubmissionParamsSchema accepts attempt 1|2', async () => {
    const parsed = await retrySubmissionParamsSchema.parseAsync({
      params: { ticketId: validId, attempt: '2' },
    });
    expect(parsed.params.attempt).toBe(2);
  });
});
