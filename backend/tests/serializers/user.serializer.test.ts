import { describe, expect, it } from 'vitest';
import { serializeUser } from '../../src/serializers/user.serializer.js';

describe('serializeUser', () => {
  it('returns exactly the six public User fields', () => {
    const createdAt = new Date('2026-01-02T03:04:05.000Z');
    const verifiedAt = new Date('2026-01-03T00:00:00.000Z');

    const result = serializeUser({
      id: 'user-1',
      name: 'Ada',
      email: 'ada@example.com',
      role: 'user',
      emailVerifiedAt: verifiedAt,
      createdAt,
    });

    expect(Object.keys(result).sort()).toEqual(
      ['createdAt', 'email', 'emailVerifiedAt', 'id', 'name', 'role'].sort(),
    );
    expect(result).toEqual({
      id: 'user-1',
      name: 'Ada',
      email: 'ada@example.com',
      role: 'user',
      emailVerifiedAt: verifiedAt.toISOString(),
      createdAt: createdAt.toISOString(),
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('serializes null emailVerifiedAt and name', () => {
    const createdAt = new Date('2026-01-02T03:04:05.000Z');

    expect(
      serializeUser({
        id: 'user-2',
        name: null,
        email: 'b@example.com',
        role: 'user',
        emailVerifiedAt: null,
        createdAt,
      }),
    ).toMatchObject({
      name: null,
      emailVerifiedAt: null,
      createdAt: createdAt.toISOString(),
    });
  });
});
