import { prisma } from '../config/db.js';

/**
 * Shared subscription gate (Doc 8 / FR-15).
 * Access when any subscription has currentPeriodEnd in the future, regardless of status.
 */
export const hasPaidAccess = async (userId: string, now: Date = new Date()): Promise<boolean> => {
  const live = await prisma.subscription.findFirst({
    where: {
      userId,
      currentPeriodEnd: { gt: now },
    },
    select: { id: true },
  });
  return live !== null;
};
