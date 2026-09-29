import { MentorMessage, MentorMessageRole, Prisma, TicketStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import type { MentorHintStage, TicketContent } from '../types/domain.js';
import { hasPaidAccess } from './subscription.service.js';
import { callMentorModel } from '../integrations/gemini.js';

const asTicketContent = (value: Prisma.JsonValue): TicketContent => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Ticket content is corrupt');
  }
  return value as unknown as TicketContent;
};

/**
 * Derive the progressive hint stage from the stored transcript (Doc 8 §8.8, FR-38).
 * Sequence: ask what was tried -> conceptual hint -> relevant file/function -> specific suggestion.
 * The client cannot pick the stage; this calculation is internal and deterministic.
 */
export const getMentorHintStage = (
  messages: Array<Pick<MentorMessage, 'role'>> | MentorMessage[],
): MentorHintStage => {
  if (!messages || messages.length === 0) {
    return 'ask_what_tried';
  }

  const mentorCount = messages.filter(
    (m) => m.role === MentorMessageRole.mentor || (m.role as string) === 'mentor',
  ).length;

  const turnIndex = mentorCount > 0 ? mentorCount : Math.floor(messages.length / 2);

  if (turnIndex === 0) {
    return 'ask_what_tried';
  }
  if (turnIndex === 1) {
    return 'conceptual_hint';
  }
  if (turnIndex === 2) {
    return 'point_to_file';
  }
  return 'specific_suggestion';
};

/**
 * Enforce the configured per-ticket mentor limit (Doc 8 §8.8, FR-41, Q-10).
 * Rate limit is derived from MentorMessage rows for this ticket.
 */
export const canSendMentorMessage = async (
  ticketId: string,
  now: Date = new Date(),
): Promise<boolean> => {
  const limit = env.MENTOR_MESSAGES_PER_TICKET;
  if (typeof limit !== 'number' || limit <= 0) {
    return true;
  }

  const where: Prisma.MentorMessageWhereInput = {
    ticketId,
    role: MentorMessageRole.user,
  };

  const windowMs = env.MENTOR_MESSAGE_WINDOW_MS;
  if (typeof windowMs === 'number' && windowMs > 0) {
    const windowStart = new Date(now.getTime() - windowMs);
    where.createdAt = { gte: windowStart };
  }

  const count = await prisma.mentorMessage.count({ where });
  return count < limit;
};

/**
 * Send a message to the AI mentor (Doc 8 §8.8, FR-37–FR-41).
 * Validates paid access, ticket state, and rate limits, calls Gemini, and persists both messages.
 * Single JSON reply, not a stream (D-15).
 */
export const sendMentorMessage = async (
  userId: string,
  ticketId: string,
  content: string,
): Promise<{ userMessage: MentorMessage; mentorMessage: MentorMessage }> => {
  if (!(await hasPaidAccess(userId))) {
    throw new ApiError(HTTP_STATUS.PAYMENT_REQUIRED, 'An active subscription is required');
  }

  if (!content || !content.trim()) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'content must not be empty');
  }

  if (
    typeof env.MENTOR_MESSAGE_MAX_CHARS === 'number' &&
    content.length > env.MENTOR_MESSAGE_MAX_CHARS
  ) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      `content must be at most ${env.MENTOR_MESSAGE_MAX_CHARS} characters`,
    );
  }

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, userId },
  });

  if (!ticket) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Ticket not found');
  }

  if (
    ticket.status !== TicketStatus.in_progress &&
    ticket.status !== TicketStatus.submitted_v1
  ) {
    throw new ApiError(
      HTTP_STATUS.CONFLICT,
      'The mentor is only available while the ticket is in progress or awaiting revision',
    );
  }

  const canSend = await canSendMentorMessage(ticketId);
  if (!canSend) {
    throw new ApiError(
      HTTP_STATUS.TOO_MANY_REQUESTS,
      'Mentor message limit reached for this ticket',
    );
  }

  const transcript = await prisma.mentorMessage.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
  });

  const hintStage = getMentorHintStage(transcript);
  const ticketContent = asTicketContent(ticket.content);

  let mentorReply: string;
  try {
    mentorReply = await callMentorModel({
      ticketContent,
      transcript: transcript.map((m) => ({ role: m.role, content: m.content })),
      userMessage: content,
      hintStage,
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, 'The mentor is unavailable, please try again');
  }

  if (!mentorReply || typeof mentorReply !== 'string' || mentorReply.trim().length === 0) {
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, 'The mentor is unavailable, please try again');
  }

  const userCreatedAt = new Date();
  const mentorCreatedAt = new Date(userCreatedAt.getTime() + 1);

  const saveMessages = async (client: { mentorMessage: typeof prisma.mentorMessage }) => {
    const userMessage = await client.mentorMessage.create({
      data: {
        ticketId,
        role: MentorMessageRole.user,
        content,
        createdAt: userCreatedAt,
      },
    });

    const mentorMessage = await client.mentorMessage.create({
      data: {
        ticketId,
        role: MentorMessageRole.mentor,
        content: mentorReply.trim(),
        createdAt: mentorCreatedAt,
      },
    });

    return { userMessage, mentorMessage };
  };

  if (typeof prisma.$transaction === 'function') {
    return prisma.$transaction(async (tx) => {
      if (typeof tx.$executeRaw === 'function') {
        await tx.$executeRaw`SELECT 1 FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`;
      }

      const limit = env.MENTOR_MESSAGES_PER_TICKET;
      if (typeof limit === 'number' && limit > 0) {
        const where: Prisma.MentorMessageWhereInput = {
          ticketId,
          role: MentorMessageRole.user,
        };
        const windowMs = env.MENTOR_MESSAGE_WINDOW_MS;
        if (typeof windowMs === 'number' && windowMs > 0) {
          where.createdAt = { gte: new Date(Date.now() - windowMs) };
        }
        const count = await tx.mentorMessage.count({ where });
        if (count >= limit) {
          throw new ApiError(
            HTTP_STATUS.TOO_MANY_REQUESTS,
            'Mentor message limit reached for this ticket',
          );
        }
      }

      return saveMessages(tx);
    });
  }

  return saveMessages(prisma);
};

/**
 * EP-29 history — oldest first; any owned ticket status (Doc 8 §8.8, §8.16).
 */
export const getMentorMessages = async (
  userId: string,
  ticketId: string,
): Promise<MentorMessage[]> => {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, userId },
    select: { id: true },
  });

  if (!ticket) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Ticket not found');
  }

  return prisma.mentorMessage.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
  });
};
