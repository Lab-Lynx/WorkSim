import { beforeEach, describe, expect, it, vi } from 'vitest';

const findFirst = vi.fn();

vi.mock('../../src/config/db.js', () => ({
  prisma: {
    subscription: { findFirst },
  },
}));

const { hasPaidAccess } = await import('../../src/services/subscription.service.js');

describe('subscription.service hasPaidAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when a subscription has currentPeriodEnd in the future', async () => {
    findFirst.mockResolvedValue({ id: 'sub-1' });
    const now = new Date('2026-06-01T00:00:00.000Z');

    await expect(hasPaidAccess('user-1', now)).resolves.toBe(true);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        currentPeriodEnd: { gt: now },
      },
      select: { id: true },
    });
  });

  it('returns false when no live subscription exists', async () => {
    findFirst.mockResolvedValue(null);
    await expect(hasPaidAccess('user-1')).resolves.toBe(false);
  });
});
