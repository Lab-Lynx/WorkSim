import { z } from 'zod';

export const REPO_NAME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

const repoNameSchema = z
  .string()
  .regex(REPO_NAME_PATTERN, 'Use letters, numbers, ".", "-" and "_" only, up to 100 characters')
  .refine((name) => name !== '.' && name !== '..', {
    message: 'Use letters, numbers, ".", "-" and "_" only, up to 100 characters',
  })
  .optional();

/** EP-22 — POST /github/repo */
export const createRepoSchema = z.object({
  body: z.object({
    starterTemplate: z.enum(['react', 'node_express', 'django'], {
      message: 'Choose a starter template (react, node_express, or django)',
    }),
    repoName: z.preprocess(
      (val) => (typeof val === 'string' ? val.trim() || undefined : val),
      repoNameSchema,
    ),
  }),
});
