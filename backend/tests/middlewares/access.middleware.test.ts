import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTP_STATUS } from '../../src/constants/index.js';

const hasPaidAccess = vi.fn();
const gitHubConnectionFindUnique = vi.fn();
const starterRepoFindUnique = vi.fn();

vi.mock('../../src/services/subscription.service.js', () => ({
  hasPaidAccess,
}));

vi.mock('../../src/config/db.js', () => ({
  prisma: {
    gitHubConnection: { findUnique: gitHubConnectionFindUnique },
    starterRepo: { findUnique: starterRepoFindUnique },
  },
}));

const {
  requirePaidAccess,
  requireGitHubConnection,
  requireStarterRepo,
} = await import('../../src/middlewares/access.middleware.js');

function mockRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

describe('access.middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requirePaidAccess calls next on success and 402 when unpaid', async () => {
    hasPaidAccess.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const req = { user: { id: 'u1', role: 'user' } };
    const res = mockRes();
    const nextOk = vi.fn();
    const nextFail = vi.fn();

    await requirePaidAccess(req as never, res as never, nextOk);
    expect(nextOk).toHaveBeenCalledWith();

    await requirePaidAccess(req as never, res as never, nextFail);
    expect(nextFail).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HTTP_STATUS.PAYMENT_REQUIRED,
        message: 'An active subscription is required',
      }),
    );
  });

  it('requireGitHubConnection returns 403 when disconnected', async () => {
    gitHubConnectionFindUnique.mockResolvedValue(null);
    const next = vi.fn();
    await requireGitHubConnection(
      { user: { id: 'u1', role: 'user' } } as never,
      mockRes() as never,
      next,
    );
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: HTTP_STATUS.FORBIDDEN }),
    );
  });

  it('requireStarterRepo returns 409 when missing', async () => {
    starterRepoFindUnique.mockResolvedValue(null);
    const next = vi.fn();
    await requireStarterRepo(
      { user: { id: 'u1', role: 'user' } } as never,
      mockRes() as never,
      next,
    );
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HTTP_STATUS.CONFLICT,
        message: 'Create your starter repository before requesting a ticket',
      }),
    );
  });
});
