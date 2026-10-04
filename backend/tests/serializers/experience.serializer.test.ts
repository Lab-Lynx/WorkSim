import { describe, it, expect } from 'vitest';
import { serializeExperience } from '../../src/serializers/experience.serializer';

describe('serializeExperience', () => {
  it('returns id, authorName, content, and createdAt', () => {
    const dbRecord = {
      id: 'exp-uuid-123',
      authorName: 'Dawit',
      content: 'Ask questions early, not after you have been stuck for an hour.',
      hiddenAt: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };

    const result = serializeExperience(dbRecord as any);

    expect(result).toEqual({
      id: 'exp-uuid-123',
      authorName: 'Dawit',
      content: 'Ask questions early, not after you have been stuck for an hour.',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
  });

  it('passes through a null authorName as-is (frontend renders "Anonymous", not the serializer)', () => {
    const dbRecord = {
      id: 'exp-1',
      authorName: null,
      content: 'Valid content here.',
      hiddenAt: null,
      createdAt: new Date(),
    };

    const result = serializeExperience(dbRecord as any);
    expect(result.authorName).toBeNull();
  });

  it('never includes hiddenAt, even when it is set', () => {
    const dbRecord = {
      id: 'exp-1',
      authorName: 'Dawit',
      content: 'Valid content here.',
      hiddenAt: new Date('2026-01-15T00:00:00Z'),
      createdAt: new Date(),
    };

    const result = serializeExperience(dbRecord as any);
    expect(result).not.toHaveProperty('hiddenAt');
  });

  it('returns exactly four keys, nothing extra', () => {
    const dbRecord = {
      id: 'exp-1',
      authorName: 'Dawit',
      content: 'Valid content here.',
      hiddenAt: null,
      createdAt: new Date(),
    };

    const result = serializeExperience(dbRecord as any);
    expect(Object.keys(result).sort()).toEqual(['authorName', 'content', 'createdAt', 'id']);
  });
});
