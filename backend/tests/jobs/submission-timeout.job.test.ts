import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/lib/prisma', () => ({
  prisma: { submission: { findMany: vi.fn() } },
}));

vi.mock('../../src/services/github-webhook.service', () => ({
  handleSubmissionTimeout: vi.fn(),
}));

import { prisma } from '../../src/lib/prisma';
import { handleSubmissionTimeout } from '../../src/services/github-webhook.service';
import {
  sweepStuckSubmissions,
  startSubmissionTimeoutScheduler,
  stopSubmissionTimeoutScheduler,
} from '../../src/jobs/submission-timeout.job';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUBMISSION_TIMEOUT_MS = '300000'; // 5 min
  process.env.SUBMISSION_TIMEOUT_SWEEP_INTERVAL_MS = '60000'; // 1 min
});

afterEach(() => {
  stopSubmissionTimeoutScheduler();
  vi.useRealTimers();
});

describe('sweepStuckSubmissions', () => {
  it('queries only non-terminal submissions older than the configured timeout', async () => {
    (prisma.submission.findMany as any).mockResolvedValue([]);
    const now = new Date('2026-01-01T00:10:00Z');

    await sweepStuckSubmissions(now);

    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['awaiting_ci', 'evaluating'] },
          submittedAt: { lt: new Date('2026-01-01T00:05:00Z') },
        }),
      }),
    );
  });

  it('calls handleSubmissionTimeout for every stuck submission found', async () => {
    (prisma.submission.findMany as any).mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    await sweepStuckSubmissions(new Date());
    expect(handleSubmissionTimeout).toHaveBeenCalledWith('a', expect.any(Date));
    expect(handleSubmissionTimeout).toHaveBeenCalledWith('b', expect.any(Date));
  });

  it('does nothing when no submissions are stuck', async () => {
    (prisma.submission.findMany as any).mockResolvedValue([]);
    await sweepStuckSubmissions(new Date());
    expect(handleSubmissionTimeout).not.toHaveBeenCalled();
  });

  it('one failing submission does not stop the sweep from processing the rest', async () => {
    (prisma.submission.findMany as any).mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    (handleSubmissionTimeout as any)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);

    await sweepStuckSubmissions(new Date());

    expect(handleSubmissionTimeout).toHaveBeenCalledTimes(2);
    expect(handleSubmissionTimeout).toHaveBeenNthCalledWith(1, 'a', expect.any(Date));
    expect(handleSubmissionTimeout).toHaveBeenNthCalledWith(2, 'b', expect.any(Date));
  });
});

describe('scheduler start/stop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('runs a sweep on each interval tick', async () => {
    (prisma.submission.findMany as any).mockResolvedValue([]);
    startSubmissionTimeoutScheduler();

    await vi.advanceTimersByTimeAsync(60000);
    expect(prisma.submission.findMany).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60000);
    expect(prisma.submission.findMany).toHaveBeenCalledTimes(2);
  });

  it('starting twice does not create two intervals', async () => {
    (prisma.submission.findMany as any).mockResolvedValue([]);
    startSubmissionTimeoutScheduler();
    startSubmissionTimeoutScheduler();

    await vi.advanceTimersByTimeAsync(60000);
    expect(prisma.submission.findMany).toHaveBeenCalledTimes(1);
  });

  it('stop prevents further sweeps', async () => {
    (prisma.submission.findMany as any).mockResolvedValue([]);
    startSubmissionTimeoutScheduler();
    stopSubmissionTimeoutScheduler();

    await vi.advanceTimersByTimeAsync(120000);
    expect(prisma.submission.findMany).not.toHaveBeenCalled();
  });
});
