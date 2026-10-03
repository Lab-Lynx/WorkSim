import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { evaluateSubmission } from './evaluation.service';

interface GitHubWorkflowRunEvent {
  action: string;
  repository: { full_name: string };
  workflow_run: { head_sha: string; conclusion: string | null; html_url: string };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function getSubmissionTimeoutMs(): number {
  const raw = process.env.SUBMISSION_TIMEOUT_MS;
  return raw ? Number(raw) : 5 * 60 * 1000; // 5-minute default pending Q-13
}

export function verifyGitHubWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader) return false;

  const secret = requireEnv('GITHUB_WEBHOOK_SECRET');
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== actualBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export async function processWorkflowRunWebhook(event: GitHubWorkflowRunEvent): Promise<void> {
  if (event.action !== 'completed') {
    return; // only a finished run tells us anything actionable
  }

  const submission = await prisma.submission.findFirst({
    where: {
      headSha: event.workflow_run.head_sha,
      ticket: {
        user: {
          starterRepo: { fullName: event.repository.full_name },
        },
      },
    },
  });

  if (!submission) {
    return; // no matching submission — log-worthy, but not an error to surface
  }

  const conclusion = event.workflow_run.conclusion;
  const ciRunUrl = event.workflow_run.html_url;

  if (conclusion !== 'success' && conclusion !== 'failure') {
    // Cancelled, timed_out, skipped, etc. — no evaluator input to give it.
    await prisma.submission.updateMany({
      where: { id: submission.id, status: 'awaiting_ci' },
      data: { status: 'failed', failureReason: `CI run ${conclusion}`, ciRunUrl },
    });
    return;
  }

  const ciPassed = conclusion === 'success';

  // The conditional WHERE is the idempotency guard: only ONE delivery of
  // this event (the first) will find status still 'awaiting_ci' and
  // actually transition it. Any duplicate/concurrent delivery finds
  // count === 0 here and stops immediately, never double-evaluating.
  const guarded = await prisma.submission.updateMany({
    where: { id: submission.id, status: 'awaiting_ci' },
    data: { ciPassed, ciRunUrl, status: 'evaluating' },
  });

  if (guarded.count === 0) {
    return; // already handled by a previous delivery of this same event
  }

  try {
    await evaluateSubmission(submission.id);

    await prisma.submission.updateMany({
      where: { id: submission.id, status: 'evaluating' },
      data: { status: 'completed' },
    });

    if (submission.attempt === 2) {
      await prisma.ticket.update({
        where: { id: submission.ticketId },
        data: { status: 'done', completedAt: new Date() },
      });
    }
  } catch {
    await prisma.submission.updateMany({
      where: { id: submission.id, status: 'evaluating' },
      data: { status: 'failed', failureReason: 'Evaluator failed, please retry' },
    });
  }
}

export async function handleSubmissionTimeout(
  submissionId: string,
  now: Date = new Date(),
): Promise<void> {
  const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!submission) return;

  const timeoutMs = getSubmissionTimeoutMs();
  const elapsed = now.getTime() - submission.submittedAt.getTime();
  if (elapsed < timeoutMs) {
    return; // not actually overdue yet — guards against a premature timeout job
  }

  await prisma.submission.updateMany({
    where: { id: submissionId, status: { in: ['awaiting_ci', 'evaluating'] } },
    data: { status: 'failed', failureReason: 'Submission timed out waiting for CI/evaluation' },
  });
}
