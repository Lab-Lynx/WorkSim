import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTP_STATUS } from '../../src/constants/index.js';
import ApiError from '../../src/utils/ApiError.js';

const hasPaidAccess = vi.fn();

vi.mock('../../src/services/subscription.service.js', () => ({
  hasPaidAccess,
}));

// Import from the specified location under test
const { requirePaidAccess } = await import('../../src/middlewares/subscription.middleware.js');

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe('subscription.middleware (requirePaidAccess — Doc 8 §8.14, Doc 9 §9.2.15)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requirePaidAccess — has access: calls next() with no error', async () => {
    hasPaidAccess.mockResolvedValue(true);
    const req = { user: { id: 'user-paid-1', role: 'user' } };
    const res = mockRes();
    const next = vi.fn();

    await requirePaidAccess(req as never, res as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('requirePaidAccess — no access: next receives ApiError(402, "An active subscription is required")', async () => {
    hasPaidAccess.mockResolvedValue(false);
    const req = { user: { id: 'user-unpaid-2', role: 'user' } };
    const res = mockRes();
    const next = vi.fn();

    await requirePaidAccess(req as never, res as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    const errorArg = next.mock.calls[0][0];
    expect(errorArg).toBeInstanceOf(ApiError);
    expect(errorArg.statusCode).toBe(HTTP_STATUS.PAYMENT_REQUIRED);
    expect(errorArg.statusCode).toBe(402);
    expect(errorArg.message).toBe('An active subscription is required');
  });

  it('requirePaidAccess — same rule as EP-15: calls hasPaidAccess(req.user.id) and does not re-implement the rule', async () => {
    hasPaidAccess.mockResolvedValue(true);
    const req = { user: { id: 'user-ep15-check', role: 'user' } };
    const res = mockRes();
    const next = vi.fn();

    await requirePaidAccess(req as never, res as never, next);

    expect(hasPaidAccess).toHaveBeenCalledTimes(1);
    expect(hasPaidAccess).toHaveBeenCalledWith('user-ep15-check');
  });

  it('requirePaidAccess — rejects unauthenticated request with 401 when req.user is missing', async () => {
    const req = {};
    const res = mockRes();
    const next = vi.fn();

    await requirePaidAccess(req as never, res as never, next);

    expect(hasPaidAccess).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    const errorArg = next.mock.calls[0][0];
    expect(errorArg).toBeInstanceOf(ApiError);
    expect(errorArg.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    expect(errorArg.statusCode).toBe(401);
  });

  it('requirePaidAccess — forwards unexpected service errors to next', async () => {
    const dbError = new Error('Database connection failed');
    hasPaidAccess.mockRejectedValue(dbError);
    const req = { user: { id: 'user-err', role: 'user' } };
    const res = mockRes();
    const next = vi.fn();

    await requirePaidAccess(req as never, res as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(dbError);
  });
});
