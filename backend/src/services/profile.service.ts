import { TicketStatus, type Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import { serializeEvaluation } from '../serializers/evaluation.serializer.js';
import type { ProfileItem, TicketContent } from '../types/domain.js';

const asTicketContent = (value: Prisma.JsonValue): TicketContent => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Ticket content is corrupt');
  }
  return value as unknown as TicketContent;
};

/**
 * EP-34 / Doc 8 §8.12 — practice work-sample projection.
 * Derived from Ticket + Submission + Evaluation; no profile table.
 * Only `done` tickets; score is always the attempt-2 final evaluation.
 */
export const getExperienceProfile = async (userId: string): Promise<ProfileItem[]> => {
  const tickets = await prisma.ticket.findMany({
    where: { userId, status: TicketStatus.done },
    orderBy: { completedAt: 'desc' },
    include: {
      submissions: {
        where: { attempt: 2 },
        include: { evaluation: true },
      },
    },
  });

  const items: ProfileItem[] = [];

  for (const ticket of tickets) {
    if (!ticket.completedAt) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'Data integrity error: done ticket missing completedAt',
      );
    }

    const attempt2 = ticket.submissions.find((s) => s.attempt === 2);
    if (!attempt2?.evaluation) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'Data integrity error: done ticket missing attempt-2 evaluation',
      );
    }

    const evaluation = serializeEvaluation(attempt2.evaluation);
    if (!evaluation || evaluation.scores === null) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'Data integrity error: done ticket missing attempt-2 evaluation scores',
      );
    }

    const content = asTicketContent(ticket.content);

    items.push({
      ticketId: ticket.id,
      title: content.title,
      category: content.category,
      difficulty: content.difficulty,
      completedAt: ticket.completedAt.toISOString(),
      evaluation,
    });
  }

  return items;
};
