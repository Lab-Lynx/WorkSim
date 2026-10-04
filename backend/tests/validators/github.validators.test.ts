import { describe, it, expect } from 'vitest';
import { createStarterRepoSchema } from '../../src/validators/github.validators.js';

describe('github.validators', () => {
  it('validates correct starterTemplate and repoName', () => {
    const result = createStarterRepoSchema.safeParse({
      body: {
        starterTemplate: 'react',
        repoName: 'my-repo',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid starterTemplate', () => {
    const result = createStarterRepoSchema.safeParse({
      body: {
        starterTemplate: 'ruby_on_rails',
      },
    });
    expect(result.success).toBe(false);
  });

  it('defaults repoName if omitted', () => {
    const result = createStarterRepoSchema.safeParse({
      body: {
        starterTemplate: 'node_express',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.repoName).toBe('work-simulator');
    }
  });

  it('rejects invalid repoName containing spaces or special characters', () => {
    const result = createStarterRepoSchema.safeParse({
      body: {
        starterTemplate: 'react',
        repoName: 'my repo with spaces!',
      },
    });
    expect(result.success).toBe(false);
  });
});
