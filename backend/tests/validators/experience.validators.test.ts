import { describe, it, expect } from 'vitest';
import {
  createExperienceSchema,
  listExperiencesQuerySchema,
} from '../../src/validators/experience.validators';

describe('createExperienceSchema', () => {
  it('accepts valid content with no authorName', () => {
    const result = createExperienceSchema.safeParse({
      content: 'This is solid advice that clears the minimum length easily.',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid content with an authorName', () => {
    const result = createExperienceSchema.safeParse({
      content: 'This is solid advice that clears the minimum length easily.',
      authorName: 'Dawit',
    });
    expect(result.success).toBe(true);
  });

  it('trims whitespace from content and authorName', () => {
    const result = createExperienceSchema.safeParse({
      content: '   This is solid advice that clears the minimum length easily.   ',
      authorName: '  Dawit  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content).toBe(
        'This is solid advice that clears the minimum length easily.',
      );
      expect(result.data.authorName).toBe('Dawit');
    }
  });

  it('rejects content under 20 characters', () => {
    const result = createExperienceSchema.safeParse({ content: 'Too short.' });
    expect(result.success).toBe(false);
  });

  it('rejects content over 2000 characters', () => {
    const result = createExperienceSchema.safeParse({ content: 'a'.repeat(2001) });
    expect(result.success).toBe(false);
  });

  it('rejects an authorName over 80 characters', () => {
    const result = createExperienceSchema.safeParse({
      content: 'This is solid advice that clears the minimum length easily.',
      authorName: 'a'.repeat(81),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing content field entirely', () => {
    const result = createExperienceSchema.safeParse({ authorName: 'Dawit' });
    expect(result.success).toBe(false);
  });

  it('accepts an hp field without rejecting the submission (validation does not know it is a honeypot)', () => {
    const result = createExperienceSchema.safeParse({
      content: 'This is solid advice that clears the minimum length easily.',
      hp: 'something a bot typed here',
    });
    expect(result.success).toBe(true);
  });
});

describe('listExperiencesQuerySchema', () => {
  it('defaults limit to 20 when omitted', () => {
    const result = listExperiencesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(20);
  });

  it('clamps an over-large limit down to 50 instead of rejecting the request', () => {
    const result = listExperiencesQuerySchema.safeParse({ limit: '500' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(50);
  });

  it('clamps a zero or negative limit up to 1 instead of rejecting the request', () => {
    const result = listExperiencesQuerySchema.safeParse({ limit: '0' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(1);
  });

  it('accepts a valid uuid cursor', () => {
    const result = listExperiencesQuerySchema.safeParse({
      cursor: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-uuid cursor', () => {
    const result = listExperiencesQuerySchema.safeParse({ cursor: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});
