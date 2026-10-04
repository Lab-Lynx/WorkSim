import { z } from 'zod';

export const createExperienceSchema = z.object({
  content: z
    .string()
    .trim()
    .min(20, 'content must be at least 20 characters')
    .max(2000, 'content must be 2000 characters or fewer'),
  authorName: z.string().trim().max(80, 'authorName must be 80 characters or fewer').optional(),
  // Honeypot: deliberately validated as "any optional string," not rejected
  // here. Rejecting it in the schema would make a filled-in honeypot fail
  // validation visibly — the whole point is the bot gets a normal-looking
  // 201, so the actual honeypot check happens later, in the service layer.
  hp: z.string().optional(),
});

export type CreateExperienceInput = z.infer<typeof createExperienceSchema>;

export const listExperiencesQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce
    .number()
    .int()
    .optional()
    .default(20)
    .transform((val) => Math.min(Math.max(val, 1), 50)),
});

export type ListExperiencesQuery = z.infer<typeof listExperiencesQuerySchema>;
