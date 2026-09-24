import { describe, it, expect } from 'vitest';
import { createStarterRepoSchema } from '../../src/validators/github.validators';

describe('createStarterRepoSchema', () => {
  it('accepts a valid starterTemplate with no repoName, defaulting repoName', () => {
    const result = createStarterRepoSchema.safeParse({ starterTemplate: 'react' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.repoName).toBe('work-simulator');
    }
  });

  it('accepts a valid starterTemplate with an explicit repoName', () => {
    const result = createStarterRepoSchema.safeParse({
      starterTemplate: 'node_express',
      repoName: 'my-repo',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.repoName).toBe('my-repo');
    }
  });

  it('accepts django as a valid starterTemplate', () => {
    const result = createStarterRepoSchema.safeParse({ starterTemplate: 'django' });
    expect(result.success).toBe(true);
  });

  it('rejects a missing starterTemplate', () => {
    const result = createStarterRepoSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects an unsupported starterTemplate value', () => {
    const result = createStarterRepoSchema.safeParse({ starterTemplate: 'ruby_on_rails' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty repoName string', () => {
    const result = createStarterRepoSchema.safeParse({ starterTemplate: 'react', repoName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a repoName with invalid characters', () => {
    const result = createStarterRepoSchema.safeParse({
      starterTemplate: 'react',
      repoName: 'my repo/!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a repoName over 100 characters', () => {
    const longName = 'a'.repeat(101);
    const result = createStarterRepoSchema.safeParse({
      starterTemplate: 'react',
      repoName: longName,
    });
    expect(result.success).toBe(false);
  });

  it('rejects starterTemplate when it is not a string (e.g. an array)', () => {
    const result = createStarterRepoSchema.safeParse({ starterTemplate: ['react'] });
    expect(result.success).toBe(false);
  });
});
