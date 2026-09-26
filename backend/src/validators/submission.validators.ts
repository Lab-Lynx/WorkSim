import { z } from 'zod';

const ticketIdParam = z.object({
  ticketId: z.string().uuid('ticketId must be a valid UUID'),
});

const attemptParam = z.object({
  ticketId: z.string().uuid('ticketId must be a valid UUID'),
  attempt: z
    .string()
    .regex(/^[12]$/, 'attempt must be 1 or 2')
    .transform((v) => Number(v) as 1 | 2),
});

/** Query boolean: absent → false; only "true" / "false" accepted. */
const includeDiffQuery = z
  .enum(['true', 'false'], {
    message: 'includeDiff must be true or false',
  })
  .optional()
  .transform((v) => v === 'true');

/** EP-30 — POST /tickets/:ticketId/submissions (no body; attempt is server-derived) */
export const submitParamsSchema = z.object({
  params: ticketIdParam,
});

/** EP-31 — GET /tickets/:ticketId/submissions/:attempt */
export const getSubmissionSchema = z.object({
  params: attemptParam,
  query: z.object({
    includeDiff: includeDiffQuery,
  }),
});

/** EP-32 — POST /tickets/:ticketId/submissions/:attempt/retry */
export const retrySubmissionParamsSchema = z.object({
  params: attemptParam,
});
