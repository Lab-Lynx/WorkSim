import crypto from 'crypto';
import { processUpcomingRenewals } from '../services/subscription-renewal.service';
import { logger } from '../lib/logger';

function getRenewalIntervalMs(): number {
  const raw = process.env.RENEWAL_JOB_INTERVAL_MS;
  return raw ? Number(raw) : 24 * 60 * 60 * 1000; // once a day by default
}

export async function runRenewalJob(): Promise<void> {
  const jobId = crypto.randomUUID();
  logger.info({ jobId }, 'renewal job started');

  try {
    const result = await processUpcomingRenewals();
    logger.info({ jobId, ...result }, 'renewal job completed');
  } catch (err) {
    // Deliberately swallowed — a failed run must never crash the server.
    // The next scheduled run (tomorrow, or whenever) simply tries again.
    logger.error({ jobId, err }, 'renewal job failed');
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startRenewalScheduler(): void {
  if (intervalHandle) return; // already running — calling start() twice is a no-op

  runRenewalJob(); // run once immediately, don't make day one of the hackathon wait 24h

  intervalHandle = setInterval(() => {
    runRenewalJob();
  }, getRenewalIntervalMs());
  intervalHandle.unref?.(); // don't let this timer alone keep the process alive
}

export function stopRenewalScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
