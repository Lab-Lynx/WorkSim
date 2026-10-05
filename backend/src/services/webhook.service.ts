import { Prisma, PaymentStatus, SubmissionStatus, SubscriptionStatus, WebhookProvider } from '@prisma/client';
import { prisma } from '../config/db.js';
import logger from '../utils/logger.js';
import { startSubmissionPipeline } from './submission-pipeline.js';

type ChapaPayload = {
  event?: string;
  status?: string;
  tx_ref?: string;
  data?: { status?: string; tx_ref?: string };
};

type GitHubPayload = {
  action?: string;
  workflow_run?: { id?: number; head_sha?: string; conclusion?: string; html_url?: string };
  repository?: { full_name?: string };
};

const claimEvent = async (provider: WebhookProvider, eventKey: string): Promise<boolean> => {
  try {
    await prisma.webhookEvent.create({ data: { provider, eventKey } });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return false;
    }
    throw error;
  }
};

export const processChapaWebhook = async (payload: ChapaPayload, eventKey: string): Promise<void> => {
  if (!(await claimEvent(WebhookProvider.chapa, eventKey))) return;

  const txRef = payload.tx_ref ?? payload.data?.tx_ref;
  const status = (payload.status ?? payload.data?.status ?? '').toLowerCase();
  if (!txRef) return;

  const succeeded = status === 'success' || status === 'succeeded' || payload.event === 'charge.success';
  const failed = status === 'failed' || status === 'failure' || payload.event === 'charge.failed';
  if (!succeeded && !failed) return;

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { chapaTxRef: txRef } });
    if (!payment || payment.status !== PaymentStatus.pending) return;

    if (succeeded) {
      const paidAt = new Date();
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.succeeded, paidAt },
      });
      const current = await tx.subscription.findFirst({
        where: { userId: payment.userId, currentPeriodEnd: { gt: paidAt } },
      });
      if (!current) {
        const currentPeriodEnd = new Date(paidAt);
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
        await tx.subscription.create({
          data: {
            userId: payment.userId,
            status: SubscriptionStatus.active,
            currentPeriodEnd,
            payments: { connect: { id: payment.id } },
          },
        });
      }
    } else {
      await tx.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.failed } });
      await tx.subscription.updateMany({
        where: { userId: payment.userId, status: SubscriptionStatus.active },
        data: { status: SubscriptionStatus.past_due },
      });
    }
  });
};

export const processGitHubWebhook = async (
  payload: GitHubPayload,
  deliveryId: string,
  eventType: string,
): Promise<void> => {
  if (!(await claimEvent(WebhookProvider.github, deliveryId))) return;
  if (eventType !== 'workflow_run' || payload.action !== 'completed') return;

  const run = payload.workflow_run;
  const fullName = payload.repository?.full_name;
  if (!run?.head_sha || !fullName) return;

  const submission = await prisma.submission.findFirst({
    where: {
      headSha: run.head_sha,
      ticket: { user: { starterRepo: { fullName } } },
      status: { in: [SubmissionStatus.awaiting_ci, SubmissionStatus.evaluating] },
    },
    select: { id: true },
  });
  if (!submission) return;

  if (run.conclusion === 'success') {
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: SubmissionStatus.evaluating,
        ciPassed: true,
        ciRunUrl: run.html_url,
      },
    });
    await startSubmissionPipeline(submission.id);
  } else {
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: SubmissionStatus.failed,
        ciPassed: false,
        ciRunUrl: run.html_url,
        failureReason: `GitHub Actions completed with conclusion: ${run.conclusion ?? 'unknown'}`,
      },
    });
  }
};

export const logWebhookProcessingFailure = (provider: string, error: unknown): void => {
  logger.error({ provider, err: error }, 'Webhook processing failed');
};
