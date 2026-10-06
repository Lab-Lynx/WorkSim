import { prisma } from '../config/db.js';
import { SubmissionStatus, TicketStatus } from '@prisma/client';
import { evaluateSubmission } from './evaluation.service.js';
import logger from '../utils/logger.js';

/**
 * Kick CI/evaluator work after submit, retry, or CI webhook.
 */
export const startSubmissionPipeline = async (submissionId: string): Promise<void> => {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
  });
  if (!submission) return;

  if (submission.status === SubmissionStatus.evaluating && submission.ciPassed) {
    try {
      await evaluateSubmission(submissionId);
      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: SubmissionStatus.completed },
      });
      if (submission.attempt === 2) {
        await prisma.ticket.update({
          where: { id: submission.ticketId },
          data: {
            status: TicketStatus.done,
            completedAt: new Date(),
          },
        });
      }
    } catch (err) {
      logger.error({ err, submissionId }, 'Submission evaluation pipeline failed');
      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: SubmissionStatus.failed,
          failureReason: err instanceof Error ? err.message : 'Evaluation failed',
        },
      });
    }
  }
};
