import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const txMock = {
  payment: { findUnique: vi.fn(), update: vi.fn() },
  subscription: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
};
const prismaMock = {
  webhookEvent: { create: vi.fn() },
  submission: { findFirst: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
};
const applyCiResult = vi.fn();
const loggerError = vi.fn();

vi.mock('../../src/config/db.js', () => ({ prisma: prismaMock }));
vi.mock('../../src/services/submission-pipeline.js', () => ({
  applyCiResult,
}));
vi.mock('../../src/utils/logger.js', () => ({
  default: { error: loggerError, warn: vi.fn(), info: vi.fn() },
}));

const { processChapaWebhook, processGitHubWebhook, logWebhookProcessingFailure } = await import(
  '../../src/services/webhook.service.js'
);

const duplicateEventError = () => {
  const error = Object.assign(new Error('duplicate webhook event'), { code: 'P2002' });
  Object.setPrototypeOf(error, Prisma.PrismaClientKnownRequestError.prototype);
  return error;
};

describe('webhook.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.webhookEvent.create.mockResolvedValue({});
    prismaMock.submission.findFirst.mockResolvedValue({ id: 'submission-1' });
    prismaMock.submission.update.mockResolvedValue({});
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => Promise<void>) =>
      fn(txMock),
    );
    txMock.payment.findUnique.mockResolvedValue({ id: 'pay-1', userId: 'user-1', status: 'pending' });
    txMock.payment.update.mockResolvedValue({});
    txMock.subscription.findFirst.mockResolvedValue(null);
    txMock.subscription.create.mockResolvedValue({});
    txMock.subscription.updateMany.mockResolvedValue({ count: 1 });
    applyCiResult.mockResolvedValue(undefined);
  });

  describe('processGitHubWebhook', () => {
    it('deduplicates an already-claimed GitHub delivery', async () => {
      prismaMock.webhookEvent.create.mockRejectedValue(duplicateEventError());

      await processGitHubWebhook(
        { action: 'completed', workflow_run: { head_sha: 'sha-1' } },
        'delivery-1',
        'workflow_run',
      );

      expect(prismaMock.submission.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.submission.update).not.toHaveBeenCalled();
    });

    it('rethrows claim errors that are not duplicates', async () => {
      prismaMock.webhookEvent.create.mockRejectedValue(new Error('db down'));

      await expect(
        processGitHubWebhook({ action: 'completed' }, 'delivery-x', 'workflow_run'),
      ).rejects.toThrow('db down');
    });

    it('ignores events that are not completed workflow runs', async () => {
      await processGitHubWebhook({ action: 'completed' }, 'delivery-3', 'push');
      await processGitHubWebhook({ action: 'requested' }, 'delivery-4', 'workflow_run');

      expect(prismaMock.submission.findFirst).not.toHaveBeenCalled();
    });

    it('ignores a workflow run without head sha or repository name', async () => {
      await processGitHubWebhook(
        { action: 'completed', workflow_run: { conclusion: 'success' }, repository: { full_name: 'a/b' } },
        'delivery-5',
        'workflow_run',
      );
      await processGitHubWebhook(
        { action: 'completed', workflow_run: { head_sha: 'sha-1' } },
        'delivery-6',
        'workflow_run',
      );

      expect(prismaMock.submission.findFirst).not.toHaveBeenCalled();
    });

    it('does nothing when no waiting submission matches the run', async () => {
      prismaMock.submission.findFirst.mockResolvedValue(null);

      await processGitHubWebhook(
        {
          action: 'completed',
          workflow_run: { head_sha: 'sha-1', conclusion: 'success' },
          repository: { full_name: 'Lab-Lynx/example' },
        },
        'delivery-7',
        'workflow_run',
      );

      expect(applyCiResult).not.toHaveBeenCalled();
    });

    it('settles a successful workflow run as passed CI', async () => {
      await processGitHubWebhook(
        {
          action: 'completed',
          workflow_run: {
            head_sha: 'sha-1',
            conclusion: 'success',
            html_url: 'https://github.com/example/actions/1',
          },
          repository: { full_name: 'Lab-Lynx/example' },
        },
        'delivery-2',
        'workflow_run',
      );

      expect(applyCiResult).toHaveBeenCalledWith('submission-1', {
        passed: true,
        runUrl: 'https://github.com/example/actions/1',
      });
    });

    it('settles a failed workflow run with its conclusion', async () => {
      await processGitHubWebhook(
        {
          action: 'completed',
          workflow_run: { head_sha: 'sha-1', conclusion: 'failure', html_url: 'https://ci/1' },
          repository: { full_name: 'Lab-Lynx/example' },
        },
        'delivery-8',
        'workflow_run',
      );

      expect(applyCiResult).toHaveBeenCalledWith('submission-1', {
        passed: false,
        runUrl: 'https://ci/1',
        conclusion: 'failure',
      });
    });

    it('reports an unknown conclusion when GitHub sends none', async () => {
      await processGitHubWebhook(
        {
          action: 'completed',
          workflow_run: { head_sha: 'sha-1' },
          repository: { full_name: 'Lab-Lynx/example' },
        },
        'delivery-9',
        'workflow_run',
      );

      expect(applyCiResult).toHaveBeenCalledWith('submission-1', {
        passed: false,
        runUrl: null,
        conclusion: 'unknown',
      });
    });
  });

  describe('processChapaWebhook', () => {
    it('deduplicates an already-claimed Chapa event', async () => {
      prismaMock.webhookEvent.create.mockRejectedValue(duplicateEventError());

      await processChapaWebhook({ tx_ref: 'tx-1', status: 'success' }, 'tx-1:success');

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('ignores a payload without a transaction reference', async () => {
      await processChapaWebhook({ status: 'success' }, 'unknown:success');

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('ignores a payload with an unrecognised status', async () => {
      await processChapaWebhook({ tx_ref: 'tx-1', status: 'pending' }, 'tx-1:pending');

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('ignores a payment that does not exist', async () => {
      txMock.payment.findUnique.mockResolvedValue(null);

      await processChapaWebhook({ tx_ref: 'tx-1', status: 'success' }, 'tx-1:success');

      expect(txMock.payment.update).not.toHaveBeenCalled();
      expect(txMock.subscription.create).not.toHaveBeenCalled();
    });

    it('ignores a payment that is no longer pending', async () => {
      txMock.payment.findUnique.mockResolvedValue({ id: 'pay-1', userId: 'user-1', status: 'succeeded' });

      await processChapaWebhook({ tx_ref: 'tx-1', status: 'success' }, 'tx-1:success');

      expect(txMock.payment.update).not.toHaveBeenCalled();
    });

    it('marks the payment succeeded and creates a monthly subscription', async () => {
      const before = Date.now();
      await processChapaWebhook({ tx_ref: 'tx-1', status: 'success' }, 'tx-1:success');

      expect(txMock.payment.findUnique).toHaveBeenCalledWith({ where: { chapaTxRef: 'tx-1' } });
      expect(txMock.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: { status: 'succeeded', paidAt: expect.any(Date) },
      });
      const createArgs = txMock.subscription.create.mock.calls[0][0];
      expect(createArgs.data).toMatchObject({
        userId: 'user-1',
        status: 'active',
        payments: { connect: { id: 'pay-1' } },
      });
      expect(createArgs.data.currentPeriodEnd.getTime()).toBeGreaterThan(before);
    });

    it('reads tx_ref and status from the nested data object', async () => {
      await processChapaWebhook({ data: { tx_ref: 'tx-2', status: 'Success' } }, 'tx-2:success');

      expect(txMock.payment.findUnique).toHaveBeenCalledWith({ where: { chapaTxRef: 'tx-2' } });
      expect(txMock.subscription.create).toHaveBeenCalled();
    });

    it('treats the charge.success event as a success', async () => {
      await processChapaWebhook({ tx_ref: 'tx-3', event: 'charge.success' }, 'tx-3:charge.success');

      expect(txMock.subscription.create).toHaveBeenCalled();
    });

    it('does not create a second subscription while one is still current', async () => {
      txMock.subscription.findFirst.mockResolvedValue({ id: 'sub-1' });

      await processChapaWebhook({ tx_ref: 'tx-1', status: 'success' }, 'tx-1:success');

      expect(txMock.payment.update).toHaveBeenCalled();
      expect(txMock.subscription.create).not.toHaveBeenCalled();
    });

    it('marks the payment failed and moves the active subscription to past due', async () => {
      await processChapaWebhook({ tx_ref: 'tx-1', status: 'failed' }, 'tx-1:failed');

      expect(txMock.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: { status: 'failed' },
      });
      expect(txMock.subscription.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'active' },
        data: { status: 'past_due' },
      });
      expect(txMock.subscription.create).not.toHaveBeenCalled();
    });

    it('treats the charge.failed event as a failure', async () => {
      await processChapaWebhook({ tx_ref: 'tx-4', event: 'charge.failed' }, 'tx-4:charge.failed');

      expect(txMock.subscription.updateMany).toHaveBeenCalled();
    });
  });

  describe('logWebhookProcessingFailure', () => {
    it('logs the provider and error', () => {
      const error = new Error('boom');

      logWebhookProcessingFailure('chapa', error);

      expect(loggerError).toHaveBeenCalledWith(
        { provider: 'chapa', err: error },
        'Webhook processing failed',
      );
    });
  });
});
