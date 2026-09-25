import type { MentorMessageRole } from '@prisma/client';

export type SerializedMentorMessage = {
  id: string;
  role: MentorMessageRole;
  content: string;
  createdAt: string;
};

export type SerializeMentorMessageInput = {
  id: string;
  role: MentorMessageRole;
  content: string;
  createdAt: Date;
  /** Internal — never serialized. */
  ticketId?: string;
};

/** Doc 5 MentorMessage — id, role, content, createdAt only (doc 8 §8.15). */
export const serializeMentorMessage = (
  message: SerializeMentorMessageInput,
): SerializedMentorMessage => ({
  id: message.id,
  role: message.role,
  content: message.content,
  createdAt: message.createdAt.toISOString(),
});
