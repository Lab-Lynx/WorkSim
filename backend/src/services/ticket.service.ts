import { randomBytes } from 'node:crypto';
import { Prisma, TicketStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import type { TicketContent } from '../types/domain.js';
import { hasPaidAccess } from './subscription.service.js';
import * as githubService from './github.service.js';
import * as ticketGeneration from './ticket-generation.service.js';

const ACTIVE_STATUSES: TicketStatus[] = [
  TicketStatus.assigned,
  TicketStatus.in_progress,
  TicketStatus.submitted_v1,
  TicketStatus.resubmitted,
];

export type TicketRecord = {
  id: string;
  userId: string;
  templateKey: string;
  status: TicketStatus;
  content: TicketContent;
  branchName: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  abandonedAt: Date | null;
};

const asTicketContent = (value: Prisma.JsonValue): TicketContent => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Ticket content is corrupt');
  }
  return value as unknown as TicketContent;
};

const toTicketRecord = (row: {
  id: string;
  userId: string;
  templateKey: string;
  status: TicketStatus;
  content: Prisma.JsonValue;
  branchName: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  abandonedAt: Date | null;
}): TicketRecord => ({
  ...row,
  content: asTicketContent(row.content),
});

const buildBranchName = (templateKey: string): string => {
  const prefix = env.BRANCH_NAME_PREFIX?.replace(/\/$/, '') || 'ticket';
  const suffix = randomBytes(4).toString('hex');
  return `${prefix}/${templateKey}-${suffix}`;
};

const findActiveTicket = async (userId: string) =>
  prisma.ticket.findFirst({
    where: { userId, status: { in: ACTIVE_STATUSES } },
  });

/**
 * Assign the next ticket (EP-23 / Doc 8 assignNextTicket).
 * Order: access → connection → repo → active check → template → generate → branch → insert.
 */
export const assignNextTicket = async (userId: string): Promise<TicketRecord> => {
  if (!(await hasPaidAccess(userId))) {
    throw new ApiError(HTTP_STATUS.PAYMENT_REQUIRED, 'An active subscription is required');
  }

  await githubService.assertGitHubConnected(userId);
  const repo = await githubService.assertStarterRepo(userId);

  const active = await findActiveTicket(userId);
  if (active) {
    throw new ApiError(HTTP_STATUS.CONFLICT, 'You already have an active ticket');
  }

  const selection = await ticketGeneration.selectNextTicketTemplate(userId);
  const template = ticketGeneration.loadTicketTemplate(selection.templateKey);

  let content: TicketContent;
  try {
    content = await ticketGeneration.generateTicketContent(template, {
      userId,
      starterTemplate: repo.starterTemplate,
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      HTTP_STATUS.BAD_GATEWAY,
      'Could not generate a ticket, please try again',
    );
  }

  const branchName = buildBranchName(template.key);

  try {
    await githubService.createTicketBranch(userId, branchName, repo.defaultBranch);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      HTTP_STATUS.BAD_GATEWAY,
      'Could not create the ticket branch on GitHub, please try again',
    );
  }

  try {
    const created = await prisma.ticket.create({
      data: {
        userId,
        templateKey: template.key,
        status: TicketStatus.assigned,
        content: content as unknown as Prisma.InputJsonValue,
        branchName,
      },
    });
    return toTicketRecord(created);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'You already have an active ticket');
    }
    throw err;
  }
};

export const getCurrentTicket = async (userId: string): Promise<TicketRecord | null> => {
  const rows = await prisma.ticket.findMany({
    where: { userId, status: { in: ACTIVE_STATUSES } },
    orderBy: { createdAt: 'desc' },
    take: 2,
  });

  if (rows.length > 1) {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      'Data integrity error: multiple active tickets',
    );
  }

  const row = rows[0];
  return row ? toTicketRecord(row) : null;
};

export const getTicketById = async (
  userId: string,
  ticketId: string,
): Promise<{
  ticket: TicketRecord;
  submissions: Array<{
    id: string;
    attempt: number;
    status: string;
    prNumber: number;
    headSha: string;
    ciPassed: boolean | null;
    ciRunUrl: string | null;
    failureReason: string | null;
    submittedAt: Date;
    evaluation: {
      feedback: string;
      requirementsMetScore: number | null;
      correctnessTestsScore: number | null;
      codeQualityScore: number | null;
      problemSolvingScore: number | null;
      totalScore: Prisma.Decimal | null;
      createdAt: Date;
    } | null;
  }>;
  repo: { fullName: string; defaultBranch: string } | null;
}> => {
  const row = await prisma.ticket.findFirst({
    where: { id: ticketId, userId },
    include: {
      submissions: {
        orderBy: { attempt: 'asc' },
        include: { evaluation: true },
      },
    },
  });

  if (!row) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Ticket not found');
  }

  const repo = await prisma.starterRepo.findUnique({
    where: { userId },
    select: { fullName: true, defaultBranch: true },
  });

  return {
    ticket: toTicketRecord(row),
    submissions: row.submissions.map((s) => ({
      id: s.id,
      attempt: s.attempt,
      status: s.status,
      prNumber: s.prNumber,
      headSha: s.headSha,
      ciPassed: s.ciPassed,
      ciRunUrl: s.ciRunUrl,
      failureReason: s.failureReason,
      submittedAt: s.submittedAt,
      evaluation: s.evaluation
        ? {
            feedback: s.evaluation.feedback,
            requirementsMetScore: s.evaluation.requirementsMetScore,
            correctnessTestsScore: s.evaluation.correctnessTestsScore,
            codeQualityScore: s.evaluation.codeQualityScore,
            problemSolvingScore: s.evaluation.problemSolvingScore,
            totalScore: s.evaluation.totalScore,
            createdAt: s.evaluation.createdAt,
          }
        : null,
    })),
    repo,
  };
};

export const startTicket = async (userId: string, ticketId: string): Promise<TicketRecord> => {
  if (!(await hasPaidAccess(userId))) {
    throw new ApiError(HTTP_STATUS.PAYMENT_REQUIRED, 'An active subscription is required');
  }

  const existing = await prisma.ticket.findFirst({ where: { id: ticketId, userId } });
  if (!existing) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Ticket not found');
  }

  const updated = await prisma.ticket.updateMany({
    where: { id: ticketId, userId, status: TicketStatus.assigned },
    data: { status: TicketStatus.in_progress },
  });

  if (updated.count === 0) {
    throw new ApiError(HTTP_STATUS.CONFLICT, 'This ticket has already been started');
  }

  const row = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  return toTicketRecord(row);
};

export const abandonTicket = async (
  userId: string,
  ticketId: string,
): Promise<{ abandonedTicketId: string; newTicket: TicketRecord | null }> => {
  if (!(await hasPaidAccess(userId))) {
    throw new ApiError(HTTP_STATUS.PAYMENT_REQUIRED, 'An active subscription is required');
  }

  await githubService.assertGitHubConnected(userId);
  await githubService.assertStarterRepo(userId);

  const existing = await prisma.ticket.findFirst({ where: { id: ticketId, userId } });
  if (!existing) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Ticket not found');
  }

  if (
    existing.status !== TicketStatus.assigned &&
    existing.status !== TicketStatus.in_progress
  ) {
    throw new ApiError(
      HTTP_STATUS.CONFLICT,
      'A ticket cannot be abandoned after it has been submitted',
    );
  }

  const abandonedAt = new Date();
  const result = await prisma.ticket.updateMany({
    where: {
      id: ticketId,
      userId,
      status: { in: [TicketStatus.assigned, TicketStatus.in_progress] },
    },
    data: { status: TicketStatus.abandoned, abandonedAt },
  });

  if (result.count === 0) {
    throw new ApiError(
      HTTP_STATUS.CONFLICT,
      'A ticket cannot be abandoned after it has been submitted',
    );
  }

  let newTicket: TicketRecord | null = null;
  try {
    newTicket = await assignNextTicket(userId);
  } catch {
    // Abandon stands even if replacement fails (Doc 5 A-31 / EP-27).
    newTicket = null;
  }

  return { abandonedTicketId: ticketId, newTicket };
};
