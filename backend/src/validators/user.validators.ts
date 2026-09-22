import { z } from 'zod';

/** EP-12 — update display name only (Doc 5 / Doc 7). */
export const updateDisplayNameSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters'),
  }),
});

export type UpdateDisplayNameInput = z.infer<typeof updateDisplayNameSchema>['body'];
