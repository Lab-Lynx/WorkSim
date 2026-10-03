import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    submission: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    ticket: {
      update: vi.fn(),
    },
  },
}));

vi.mock('../../src/services/evaluation.service', () => ({
  evaluateSubmission: vi.fn(),
}));

import { prisma } from '../../src/lib/prisma';
import { evaluateSubmission } from '../../src/services/evaluation.service';
import {
  verifyGitHubWebhookSignature,
  processWorkflowRunWebhook,
  handleSubmissionTimeout,
} from '../../src/services/github-webhook.service';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.SUBMISSION_TIMEOUT_MS = '300000'; // 5 minutes
});

function signBody(body: string, secret: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('verifyGitHubWebhookSignature', () => {
  it('accepts a correctly signed body', () => {
    const body = Buffer.from(JSON.stringify({ hello: 'world' }));
    const signature = signBody(body.toString(), 'test-webhook-secret');
    expect(verifyGitHubWebhookSignature(body, signature)).toBe(true);
  });

  it('rejects a missing signature header', () => {
    const body = Buffer.from(JSON.stringify({ hello: 'world' }));
    expect(verifyGitHubWebhookSignature(body, undefined)).toBe(false);
  });

  it('rejects a signature computed with the wrong secret', () => {
    const body = Buffer.from(JSON.stringify({ hello: 'world' }));
    const wrongSignature = signBody(body.toString(), 'wrong-secret');
    expect(verifyGitHubWebhookSignature(body, wrongSignature)).toBe(false);
  });

  it('rejects when the body was altered after signing', () => {
    const originalBody = JSON.stringify({ hello: 'world' });
    const signature = signBody(originalBody, 'test-webhook-secret');
    const tamperedBody = Buffer.from(JSON.stringify({ hello: 'WORLD' }));
    expect(verifyGitHubWebhookSignature(tamperedBody, signature)).toBe(false);
  });
});

describe('processWorkflowRunWebhook', () => {
  const baseEvent = {
    action: 'completed',
    repository: { full_name: 'octocat/work-simulator' },
    workflow_run: {
      head_sha: 'sha-123',
      conclusion: 'success',
      html_url: 'https://github.com/run/1',
    },
  };

  it('ignores non-completed actions with no mutation', async () => {
    await processWorkflowRunWebhook({ ...baseEvent, action: 'requested' } as any);
    expect(prisma.submission.findFirst).not.toHaveBeenCalled();
  });

  it('ignores events with no matching submission', async () => {
    (prisma.submission.findFirst as any).mockResolvedValue(null);
    await processWorkflowRunWebhook(baseEvent as any);
    expect(prisma.submission.updateMany).not.toHaveBeenCalled();
    expect(evaluateSubmission).not.toHaveBeenCalled();
  });

  it('success conclusion: sets ciPassed=true and proceeds to evaluation', async () => {
    (prisma.submission.findFirst as any).mockResolvedValue({
      id: 'sub-1',
      attempt: 1,
      status: 'awaiting_ci',
    });
    (prisma.submission.updateMany as any).mockResolvedValue({ count: 1 });
    (evaluateSubmission as any).mockResolvedValue({ feedback: 'looks good' });

    await processWorkflowRunWebhook(baseEvent as any);

    expect(prisma.submission.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1', status: 'awaiting_ci' },
        data: expect.objectContaining({ ciPassed: true, status: 'evaluating' }),
      }),
    );
    expect(evaluateSubmission).toHaveBeenCalledWith('sub-1');
  });

  it('failure conclusion: sets ciPassed=false but still proceeds to evaluation', async () => {
    (prisma.submission.findFirst as any).mockResolvedValue({
      id: 'sub-2',
      attempt: 1,
      status: 'awaiting_ci',
    });
    (prisma.submission.updateMany as any).mockResolvedValue({ count: 1 });
    (evaluateSubmission as any).mockResolvedValue({ feedback: 'tests failed' });

    await processWorkflowRunWebhook({
      ...baseEvent,
      workflow_run: { ...baseEvent.workflow_run, conclusion: 'failure' },
    } as any);

    expect(prisma.submission.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ciPassed: false, status: 'evaluating' }),
      }),
    );
    expect(evaluateSubmission).toHaveBeenCalledWith('sub-2');
  });

  it('other conclusions (e.g. cancelled) mark the submission failed WITHOUT calling evaluation', async () => {
    (prisma.submission.findFirst as any).mockResolvedValue({
      id: 'sub-3',
      attempt: 1,
      status: 'awaiting_ci',
    });
    (prisma.submission.updateMany as any).mockResolvedValue({ count: 1 });

    await processWorkflowRunWebhook({
      ...baseEvent,
      workflow_run: { ...baseEvent.workflow_run, conclusion: 'cancelled' },
    } as any);

    expect(prisma.submission.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    );
    expect(evaluateSubmission).not.toHaveBeenCalled();
  });

  it('attempt 2 completion moves the ticket to done and sets completedAt', async () => {
    (prisma.submission.findFirst as any).mockResolvedValue({
      id: 'sub-4',
      ticketId: 'ticket-1',
      attempt: 2,
      status: 'awaiting_ci',
    });
    (prisma.submission.updateMany as any).mockResolvedValue({ count: 1 });
    (evaluateSubmission as any).mockResolvedValue({
      feedback: 'great work',
      scores: { total: 88 },
    });

    await processWorkflowRunWebhook(baseEvent as any);

    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { id: 'ticket-1' },
      data: { status: 'done', completedAt: expect.any(Date) },
    });
  });

  it('attempt 1 completion does NOT move the ticket to done', async () => {
    (prisma.submission.findFirst as any).mockResolvedValue({
      id: 'sub-5',
      ticketId: 'ticket-1',
      attempt: 1,
      status: 'awaiting_ci',
    });
    (prisma.submission.updateMany as any).mockResolvedValue({ count: 1 });
    (evaluateSubmission as any).mockResolvedValue({ feedback: 'feedback only' });

    await processWorkflowRunWebhook(baseEvent as any);

    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it('is idempotent: a duplicate delivery for an already-processed submission is a no-op', async () => {
    (prisma.submission.findFirst as any).mockResolvedValue({
      id: 'sub-6',
      attempt: 1,
      status: 'evaluating', // already past awaiting_ci
    });
    (prisma.submission.updateMany as any).mockResolvedValue({ count: 0 }); // guard didn't match

    await processWorkflowRunWebhook(baseEvent as any);

    expect(evaluateSubmission).not.toHaveBeenCalled();
  });

  it('marks the submission failed if evaluateSubmission throws', async () => {
    (prisma.submission.findFirst as any).mockResolvedValue({
      id: 'sub-7',
      attempt: 1,
      status: 'awaiting_ci',
    });
    (prisma.submission.updateMany as any).mockResolvedValue({ count: 1 });
    (evaluateSubmission as any).mockRejectedValue(new Error('groq boom'));

    await processWorkflowRunWebhook(baseEvent as any);

    expect(prisma.submission.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    );
  });
});

describe('handleSubmissionTimeout', () => {
  it('marks a stuck submission failed once the configured timeout has passed', async () => {
    const submittedAt = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago, timeout is 5 min
    (prisma.submission.findUnique as any).mockResolvedValue({
      id: 'sub-8',
      status: 'awaiting_ci',
      submittedAt,
    });
    (prisma.submission.updateMany as any).mockResolvedValue({ count: 1 });

    await handleSubmissionTimeout('sub-8');

    expect(prisma.submission.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-8', status: { in: ['awaiting_ci', 'evaluating'] } },
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );
  });

  it('does nothing if the timeout has not actually elapsed yet', async () => {
    const submittedAt = new Date(Date.now() - 1 * 60 * 1000); // only 1 min ago
    (prisma.submission.findUnique as any).mockResolvedValue({
      id: 'sub-9',
      status: 'awaiting_ci',
      submittedAt,
    });

    await handleSubmissionTimeout('sub-9');

    expect(prisma.submission.updateMany).not.toHaveBeenCalled();
  });

  it('is a no-op if the submission is already in a terminal state', async () => {
    const submittedAt = new Date(Date.now() - 10 * 60 * 1000);
    (prisma.submission.findUnique as any).mockResolvedValue({
      id: 'sub-10',
      status: 'completed',
      submittedAt,
    });
    (prisma.submission.updateMany as any).mockResolvedValue({ count: 0 });

    await handleSubmissionTimeout('sub-10');

    // updateMany is called but its own WHERE guard prevents any real change —
    // status:'completed' never matches the in:[...] filter
    expect(prisma.submission.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-10', status: { in: ['awaiting_ci', 'evaluating'] } },
      }),
    );
  });

  it('does nothing if the submission does not exist', async () => {
    (prisma.submission.findUnique as any).mockResolvedValue(null);
    await handleSubmissionTimeout('sub-does-not-exist');
    expect(prisma.submission.updateMany).not.toHaveBeenCalled();
  });
});
