import { prisma } from '../lib/prisma';
import { handleSubmissionTimeout } from '../services/github-webhook.service';

const NON_TERMINAL_STATUSES = ['awaiting_ci', 'evaluating'];

function getSubmissionTimeoutMs(): number {
  const raw = process.env.SUBMISSION_TIMEOUT_MS;
  return raw ? Number(raw) : 5 * 60 * 1000; // 5-minute default pending Q-13
}

function getSweepIntervalMs(): number {
  const raw = process.env.SUBMISSION_TIMEOUT_SWEEP_INTERVAL_MS;
  return raw ? Number(raw) : 60 * 1000; // sweep once a minute by default
}

export async function sweepStuckSubmissions(now: Date = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - getSubmissionTimeoutMs());

  const stuck = await prisma.submission.findMany({
    where: { status: { in: NON_TERMINAL_STATUSES }, submittedAt: { lt: cutoff } },
    select: { id: true },
  });

  for (const { id } of stuck) {
    try {
      await handleSubmissionTimeout(id, now);
    } catch (err) {
      // One bad submission shouldn't block the rest of the sweep.
      console.error(`submission timeout failed for ${id}`, err);
    }
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startSubmissionTimeoutScheduler(): void {
  if (intervalHandle) return; // already running — calling start() twice is a no-op
  intervalHandle = setInterval(() => {
    sweepStuckSubmissions().catch((err) => console.error('submission timeout sweep failed', err));
  }, getSweepIntervalMs());
  intervalHandle.unref?.(); // don't let this timer alone keep the process alive
}

export function stopSubmissionTimeoutScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
