import { z } from 'zod';

export const REPO_NAME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

const repoNameSchema = z
  .string()
  .regex(REPO_NAME_PATTERN, 'Use letters, numbers, ".", "-" and "_" only, up to 100 characters')
  .refine((name) => name !== '.' && name !== '..', {
    message: 'Use letters, numbers, ".", "-" and "_" only, up to 100 characters',
  })
  .optional();

export const createStarterRepoBodySchema = z.object({
  starterTemplate: z.enum(['react', 'node_express', 'django'], {
    message: 'starterTemplate must be one of: react, node_express, django',
  }),
  repoName: z
    .preprocess((val) => (typeof val === 'string' ? val.trim() || undefined : val), repoNameSchema)
    .default('work-simulator'),
});

export const createStarterRepoSchema = z.object({
  body: createStarterRepoBodySchema,
});

export const createRepoSchema = createStarterRepoSchema;

export type CreateStarterRepoInput = z.infer<typeof createStarterRepoBodySchema>;
