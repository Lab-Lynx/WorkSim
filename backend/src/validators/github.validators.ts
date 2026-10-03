import { z } from 'zod';

export const createStarterRepoBodySchema = z.object({
  starterTemplate: z.enum(['react', 'node_express', 'django'], {
    message: 'starterTemplate must be one of: react, node_express, django',
  }),
  repoName: z
    .string()
    .min(1, 'repoName cannot be empty')
    .max(100, 'repoName must be 100 characters or fewer')
    .regex(
      /^[A-Za-z0-9._-]+$/,
      'repoName may only contain letters, numbers, dots, hyphens, and underscores',
    )
    .optional()
    .default('work-simulator'),
});

export const createStarterRepoSchema = z.object({
  body: createStarterRepoBodySchema,
});

export type CreateStarterRepoInput = z.infer<typeof createStarterRepoBodySchema>;
