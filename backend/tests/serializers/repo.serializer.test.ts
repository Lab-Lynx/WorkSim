import { describe, it, expect } from 'vitest';
import { serializeRepo } from '../../src/serializers/repo.serializer';

describe('serializeRepo', () => {
  it('returns only fullName, starterTemplate, and defaultBranch', () => {
    const dbRecord = {
      id: 'uuid-123',
      userId: 'user-456',
      starterTemplate: 'react',
      githubRepoId: '987654321',
      fullName: 'octocat/work-simulator',
      defaultBranch: 'main',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };

    const result = serializeRepo(dbRecord as any);

    expect(result).toEqual({
      fullName: 'octocat/work-simulator',
      starterTemplate: 'react',
      defaultBranch: 'main',
    });
  });

  it('never includes githubRepoId', () => {
    const dbRecord = {
      id: 'uuid-123',
      userId: 'user-456',
      starterTemplate: 'node_express',
      githubRepoId: '111222333',
      fullName: 'octocat/work-simulator',
      defaultBranch: 'main',
      createdAt: new Date(),
    };

    const result = serializeRepo(dbRecord as any);
    expect(result).not.toHaveProperty('githubRepoId');
    expect(JSON.stringify(result)).not.toContain('111222333');
  });

  it('never includes id, userId, or createdAt', () => {
    const dbRecord = {
      id: 'uuid-123',
      userId: 'user-456',
      starterTemplate: 'django',
      githubRepoId: '444',
      fullName: 'octocat/repo',
      defaultBranch: 'main',
      createdAt: new Date(),
    };

    const result = serializeRepo(dbRecord as any);
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('createdAt');
  });

  it('returns exactly three keys, nothing extra', () => {
    const dbRecord = {
      id: 'uuid-123',
      userId: 'user-456',
      starterTemplate: 'react',
      githubRepoId: '444',
      fullName: 'octocat/repo',
      defaultBranch: 'main',
      createdAt: new Date(),
    };

    const result = serializeRepo(dbRecord as any);
    expect(Object.keys(result).sort()).toEqual(['defaultBranch', 'fullName', 'starterTemplate']);
  });
});
