import { describe, expect, it } from 'vitest';
import { MentorMessageRole } from '@prisma/client';
import { serializeMentorMessage } from '../../src/serializers/mentor-message.serializer.js';

describe('serializeMentorMessage (doc 8 §8.15)', () => {
  it('returns exactly id, role, content, createdAt', () => {
    const createdAt = new Date('2026-03-01T12:00:00.000Z');
    const result = serializeMentorMessage({
      id: 'msg-1',
      ticketId: 'ticket-secret',
      role: MentorMessageRole.user,
      content: 'How do I fix the stale closure?',
      createdAt,
    });

    expect(Object.keys(result).sort()).toEqual(['content', 'createdAt', 'id', 'role']);
    expect(result).toEqual({
      id: 'msg-1',
      role: 'user',
      content: 'How do I fix the stale closure?',
      createdAt: createdAt.toISOString(),
    });
  });

  it('never leaks ticketId or other internal fields', () => {
    const result = serializeMentorMessage({
      id: 'msg-2',
      ticketId: 'should-not-appear',
      role: MentorMessageRole.mentor,
      content: '<script>alert(1)</script>',
      createdAt: new Date('2026-03-02T00:00:00.000Z'),
    });

    expect(result).not.toHaveProperty('ticketId');
    expect(result.role).toBe('mentor');
    expect(result.content).toBe('<script>alert(1)</script>');
  });
});
