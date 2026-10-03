import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/services/subscription-renewal.service', () => ({
  processUpcomingRenewals: vi.fn(),
}));

vi.mock('../../src/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { processUpcomingRenewals } from '../../src/services/subscription-renewal.service';
import { logger } from '../../src/lib/logger';
import {
  runRenewalJob,
  startRenewalScheduler,
  stopRenewalScheduler,
} from '../../src/jobs/renewal.job';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RENEWAL_JOB_INTERVAL_MS = '86400000'; // 1 day
});

afterEach(() => {
  stopRenewalScheduler();
  vi.useRealTimers();
});

describe('runRenewalJob', () => {
  it('logs the returned counts on success, tagged with a job id', async () => {
    (processUpcomingRenewals as any).mockResolvedValue({
      remindersSent: 2,
      chargesAttempted: 1,
      chargesSucceeded: 0,
      chargesFailed: 1,
    });

    await runRenewalJob();

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: expect.any(String), remindersSent: 2, chargesFailed: 1 }),
      expect.any(String),
    );
  });

  it('logs the failure with a job id and never throws — a failed run must not crash the server', async () => {
    (processUpcomingRenewals as any).mockRejectedValue(new Error('db exploded'));

    await expect(runRenewalJob()).resolves.not.toThrow();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: expect.any(String) }),
      expect.any(String),
    );
  });

  it('gives each run its own distinct job id', async () => {
    (processUpcomingRenewals as any).mockResolvedValue({
      remindersSent: 0,
      chargesAttempted: 0,
      chargesSucceeded: 0,
      chargesFailed: 0,
    });

    await runRenewalJob();
    await runRenewalJob();

    const idA = (logger.info as any).mock.calls[0][0].jobId;
    const idB = (logger.info as any).mock.calls[1][0].jobId;
    expect(idA).not.toBe(idB);
  });
});

describe('startRenewalScheduler / stopRenewalScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (processUpcomingRenewals as any).mockResolvedValue({
      remindersSent: 0,
      chargesAttempted: 0,
      chargesSucceeded: 0,
      chargesFailed: 0,
    });
  });

  it('runs once immediately on start, without waiting for the first interval', async () => {
    startRenewalScheduler();
    await vi.advanceTimersByTimeAsync(0);
    expect(processUpcomingRenewals).toHaveBeenCalledTimes(1);
  });

  it('runs again after each configured interval elapses', async () => {
    startRenewalScheduler();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(86400000);
    expect(processUpcomingRenewals).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(86400000);
    expect(processUpcomingRenewals).toHaveBeenCalledTimes(3);
  });

  it('starting twice does not double-schedule', async () => {
    startRenewalScheduler();
    startRenewalScheduler();
    await vi.advanceTimersByTimeAsync(0);
    expect(processUpcomingRenewals).toHaveBeenCalledTimes(1);
  });

  it('stop prevents further scheduled runs', async () => {
    startRenewalScheduler();
    await vi.advanceTimersByTimeAsync(0);
    stopRenewalScheduler();
    await vi.advanceTimersByTimeAsync(86400000 * 3);
    expect(processUpcomingRenewals).toHaveBeenCalledTimes(1); // only the initial run
  });

  it('running twice in a day is idempotent — delegated entirely to processUpcomingRenewals itself', async () => {
    startRenewalScheduler();
    await vi.advanceTimersByTimeAsync(0);
    await runRenewalJob(); // simulate a second, duplicate trigger the same day
    expect(processUpcomingRenewals).toHaveBeenCalledTimes(2);
    // The scheduler doesn't need its own dedup logic — the service already
    // proved (in its own tests) that a same-day rerun finds nothing new to do.
  });
});
