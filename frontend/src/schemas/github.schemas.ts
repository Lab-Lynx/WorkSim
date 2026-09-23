import { z } from 'zod';

export const REPO_NAME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

const repoNameSchema = z
  .string()
  .regex(REPO_NAME_PATTERN, 'Use letters, numbers, ".", "-" and "_" only, up to 100 characters')
  .refine((repoName) => repoName !== '.' && repoName !== '..', {
    message: 'Use letters, numbers, ".", "-" and "_" only, up to 100 characters',
  })
  .optional();

export const createRepoSchema = z.object({
  starterTemplate: z.enum(['react', 'node_express', 'django'], {
    error: 'Choose a starter template',
  }),
  repoName: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() || undefined : value),
    repoNameSchema
  ),
});

export type CreateRepoInput = z.infer<typeof createRepoSchema>;
