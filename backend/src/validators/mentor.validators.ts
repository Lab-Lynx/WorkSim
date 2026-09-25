import { z } from 'zod';
import { env } from '../config/env.js';

const ticketIdParam = z.object({
  ticketId: z.string().uuid('ticketId must be a valid UUID'),
});

/**
 * Q-10b — max length comes from MENTOR_MESSAGE_MAX_CHARS.
 * When unset, only non-empty trimmed content is required.
 */
export const buildMentorContentSchema = (maxChars?: number) => {
  const base = z
    .string({ message: 'content is required' })
    .trim()
    .min(1, 'content must not be empty');

  if (typeof maxChars === 'number') {
    return base.max(maxChars, `content must be at most ${maxChars} characters`);
  }

  return base;
};

/** EP-28 — POST /tickets/:ticketId/mentor/messages */
export const sendMentorMessageSchema = z.object({
  params: ticketIdParam,
  body: z.object({
    content: buildMentorContentSchema(env.MENTOR_MESSAGE_MAX_CHARS),
  }),
});

/** EP-29 — GET /tickets/:ticketId/mentor/messages */
export const getMentorMessagesParamsSchema = z.object({
  params: ticketIdParam,
});

export type SendMentorMessageInput = z.infer<typeof sendMentorMessageSchema>['body'];
