import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const prismaMock = {
  webhookEvent: { create: vi.fn() },
  submission: { findFirst: vi.fn(), update: vi.fn() },
};
const startSubmissionPipeline = vi.fn();

vi.mock('../../src/config/db.js', () => ({ prisma: prismaMock }));
vi.mock('../../src/services/submission-pipeline.js', () => ({
  startSubmissionPipeline,
}));

const { processGitHubWebhook } = await import('../../src/services/webhook.service.js');

describe('webhook.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.webhookEvent.create.mockResolvedValue({});
    prismaMock.submission.findFirst.mockResolvedValue({ id: 'submission-1' });
    prismaMock.submission.update.mockResolvedValue({});
    startSubmissionPipeline.mockResolvedValue(undefined);
  });

  it('deduplicates an already-claimed GitHub delivery', async () => {
    const duplicateError = Object.assign(new Error('duplicate webhook event'), {
      code: 'P2002',
    });
    Object.setPrototypeOf(duplicateError, Prisma.PrismaClientKnownRequestError.prototype);
    prismaMock.webhookEvent.create.mockRejectedValue(duplicateError);

    await processGitHubWebhook(
      { action: 'completed', workflow_run: { head_sha: 'sha-1' } },
      'delivery-1',
      'workflow_run',
    );

    expect(prismaMock.submission.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.submission.update).not.toHaveBeenCalled();
  });

  it('marks successful workflow completion and starts evaluation', async () => {
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

    expect(prismaMock.submission.update).toHaveBeenCalledWith({
      where: { id: 'submission-1' },
      data: {
        status: 'evaluating',
        ciPassed: true,
        ciRunUrl: 'https://github.com/example/actions/1',
      },
    });
    expect(startSubmissionPipeline).toHaveBeenCalledWith('submission-1');
  });
});
