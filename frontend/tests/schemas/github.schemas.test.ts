import { describe, expect, it } from 'vitest';
import { createRepoSchema } from '@/schemas/github.schemas';

describe('createRepoSchema', () => {
  it.each(['react', 'node_express', 'django'])(
    'accepts the supported %s template',
    (starterTemplate) => {
      expect(createRepoSchema.parse({ starterTemplate, repoName: 'my-project_1' })).toEqual({
        starterTemplate,
        repoName: 'my-project_1',
      });
    }
  );

  it('allows repoName to be omitted', () => {
    expect(createRepoSchema.parse({ starterTemplate: 'react' })).toEqual({
      starterTemplate: 'react',
    });
  });

  it('trims repoName and treats a whitespace-only value as omitted', () => {
    expect(createRepoSchema.parse({ starterTemplate: 'react', repoName: '  my-app  ' })).toEqual({
      starterTemplate: 'react',
      repoName: 'my-app',
    });
    expect(createRepoSchema.parse({ starterTemplate: 'react', repoName: '   ' })).toEqual({
      starterTemplate: 'react',
    });
  });

  it('accepts the maximum valid repo name length', () => {
    expect(
      createRepoSchema.parse({ starterTemplate: 'django', repoName: 'a'.repeat(100) }).repoName
    ).toHaveLength(100);
  });

  it.each(['rails', 'spring', '', 'REACT'])(
    'rejects unsupported starter template %s',
    (starterTemplate) => {
      expect(() => createRepoSchema.parse({ starterTemplate, repoName: 'valid-name' })).toThrow();
    }
  );

  it.each(['.', '..', 'has spaces', 'has/slash', 'has$symbol', 'a'.repeat(101)])(
    'rejects invalid repo name %s',
    (repoName) => {
      expect(() => createRepoSchema.parse({ starterTemplate: 'react', repoName })).toThrow();
    }
  );
});
