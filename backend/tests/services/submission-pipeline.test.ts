import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubmissionStatus, TicketStatus } from '@prisma/client';

const submissionFindUnique = vi.fn();
const submissionUpdate = vi.fn();
const ticketUpdate = vi.fn();
const evaluateSubmission = vi.fn();

vi.mock('../../src/config/db.js', () => ({
  prisma: {
    submission: {
      findUnique: (...args: unknown[]) => submissionFindUnique(...args),
      update: (...args: unknown[]) => submissionUpdate(...args),
    },
    ticket: {
      update: (...args: unknown[]) => ticketUpdate(...args),
    },
  },
}));

vi.mock('../../src/services/evaluation.service.js', () => ({
  evaluateSubmission: (...args: unknown[]) => evaluateSubmission(...args),
}));

const { startSubmissionPipeline } = await import('../../src/services/submission-pipeline.js');

describe('submission-pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing if submission is not found', async () => {
    submissionFindUnique.mockResolvedValue(null);
    await startSubmissionPipeline('sub-none');
    expect(evaluateSubmission).not.toHaveBeenCalled();
    expect(submissionUpdate).not.toHaveBeenCalled();
  });

  it('does nothing if submission is awaiting_ci', async () => {
    submissionFindUnique.mockResolvedValue({
      id: 'sub-1',
      status: SubmissionStatus.awaiting_ci,
      ciPassed: null,
    });
    await startSubmissionPipeline('sub-1');
    expect(evaluateSubmission).not.toHaveBeenCalled();
    expect(submissionUpdate).not.toHaveBeenCalled();
  });

  it('attempt 1: runs evaluation, marks submission completed, does not mark ticket done', async () => {
    submissionFindUnique.mockResolvedValue({
      id: 'sub-1',
      ticketId: 'ticket-1',
      attempt: 1,
      status: SubmissionStatus.evaluating,
      ciPassed: true,
    });
    evaluateSubmission.mockResolvedValue({ id: 'eval-1' });

    await startSubmissionPipeline('sub-1');

    expect(evaluateSubmission).toHaveBeenCalledWith('sub-1');
    expect(submissionUpdate).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { status: SubmissionStatus.completed },
    });
    expect(ticketUpdate).not.toHaveBeenCalled();
  });

  it('attempt 2: runs evaluation, marks submission completed, and marks ticket done with completedAt', async () => {
    submissionFindUnique.mockResolvedValue({
      id: 'sub-2',
      ticketId: 'ticket-1',
      attempt: 2,
      status: SubmissionStatus.evaluating,
      ciPassed: true,
    });
    evaluateSubmission.mockResolvedValue({ id: 'eval-2' });

    await startSubmissionPipeline('sub-2');

    expect(evaluateSubmission).toHaveBeenCalledWith('sub-2');
    expect(submissionUpdate).toHaveBeenCalledWith({
      where: { id: 'sub-2' },
      data: { status: SubmissionStatus.completed },
    });
    expect(ticketUpdate).toHaveBeenCalledWith({
      where: { id: 'ticket-1' },
      data: {
        status: TicketStatus.done,
        completedAt: expect.any(Date),
      },
    });
  });

  it('marks submission failed if evaluation throws an error', async () => {
    submissionFindUnique.mockResolvedValue({
      id: 'sub-1',
      ticketId: 'ticket-1',
      attempt: 1,
      status: SubmissionStatus.evaluating,
      ciPassed: true,
    });
    evaluateSubmission.mockRejectedValue(new Error('Groq model timeout'));

    await startSubmissionPipeline('sub-1');

    expect(submissionUpdate).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: {
        status: SubmissionStatus.failed,
        failureReason: 'Groq model timeout',
      },
    });
  });
});
