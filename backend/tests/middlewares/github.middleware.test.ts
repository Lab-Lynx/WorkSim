import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTP_STATUS } from '../../src/constants/index.js';
import ApiError from '../../src/utils/ApiError.js';

const gitHubConnectionFindUnique = vi.fn();
const starterRepoFindUnique = vi.fn();

vi.mock('../../src/config/db.js', () => ({
  prisma: {
    gitHubConnection: { findUnique: gitHubConnectionFindUnique },
    starterRepo: { findUnique: starterRepoFindUnique },
  },
}));

const githubApiMock = {
  createBranch: vi.fn(),
  createRepo: vi.fn(),
  getUser: vi.fn(),
};

vi.mock('../../src/integrations/github.js', () => githubApiMock);

// Import from the specified location under test (Doc 8 §8.14)
const { requireGitHubConnection, requireStarterRepo } = await import(
  '../../src/middlewares/github.middleware.js'
);

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe('github.middleware (Doc 8 §8.14, Doc 9 §9.2.15)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requireGitHubConnection', () => {
    it('requireGitHubConnection — connected: calls next() when connection row exists', async () => {
      gitHubConnectionFindUnique.mockResolvedValue({
        id: 'conn-1',
        userId: 'user-connected-1',
        githubUserId: 12345,
        githubUsername: 'octocat',
        accessTokenEncrypted: 'enc_token_val',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const req = { user: { id: 'user-connected-1', role: 'user' } };
      const res = mockRes();
      const next = vi.fn();

      await requireGitHubConnection(req as never, res as never, next);

      expect(gitHubConnectionFindUnique).toHaveBeenCalledWith({
        where: { userId: 'user-connected-1' },
      });
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });

    it('requireGitHubConnection — not connected: next receives 403 with the Doc 5 message "GitHub is not connected. Connect GitHub to continue"', async () => {
      gitHubConnectionFindUnique.mockResolvedValue(null);
      const req = { user: { id: 'user-disconnected-2', role: 'user' } };
      const res = mockRes();
      const next = vi.fn();

      await requireGitHubConnection(req as never, res as never, next);

      expect(gitHubConnectionFindUnique).toHaveBeenCalledWith({
        where: { userId: 'user-disconnected-2' },
      });
      expect(next).toHaveBeenCalledTimes(1);
      const errorArg = next.mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(ApiError);
      expect(errorArg.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
      expect(errorArg.statusCode).toBe(403);
      expect(errorArg.message).toBe(
        'GitHub is not connected. Connect GitHub to continue',
      );
    });

    it('requireGitHubConnection — no token check: passes with connection row with a revoked token; makes no GitHub call', async () => {
      gitHubConnectionFindUnique.mockResolvedValue({
        id: 'conn-2',
        userId: 'user-revoked-3',
        githubUserId: 67890,
        githubUsername: 'revoked-user',
        accessTokenEncrypted: 'revoked_expired_token',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const req = { user: { id: 'user-revoked-3', role: 'user' } };
      const res = mockRes();
      const next = vi.fn();

      await requireGitHubConnection(req as never, res as never, next);

      expect(gitHubConnectionFindUnique).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(githubApiMock.getUser).not.toHaveBeenCalled();
      expect(githubApiMock.createBranch).not.toHaveBeenCalled();
      expect(githubApiMock.createRepo).not.toHaveBeenCalled();
    });

    it('requireGitHubConnection — unauthenticated: returns 401 when req.user is missing', async () => {
      const req = {};
      const res = mockRes();
      const next = vi.fn();

      await requireGitHubConnection(req as never, res as never, next);

      expect(gitHubConnectionFindUnique).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
      const errorArg = next.mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(ApiError);
      expect(errorArg.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(errorArg.statusCode).toBe(401);
    });

    it('requireGitHubConnection — forwards DB errors to next', async () => {
      const dbError = new Error('Database query failed');
      gitHubConnectionFindUnique.mockRejectedValue(dbError);
      const req = { user: { id: 'user-err', role: 'user' } };
      const res = mockRes();
      const next = vi.fn();

      await requireGitHubConnection(req as never, res as never, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  describe('requireStarterRepo', () => {
    it('requireStarterRepo — repo exists: calls next() when repo row exists', async () => {
      starterRepoFindUnique.mockResolvedValue({
        id: 'repo-1',
        userId: 'user-repo-1',
        githubRepoId: 98765,
        fullName: 'octocat/starter-repo',
        starterTemplate: 'react',
        defaultBranch: 'main',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const req = { user: { id: 'user-repo-1', role: 'user' } };
      const res = mockRes();
      const next = vi.fn();

      await requireStarterRepo(req as never, res as never, next);

      expect(starterRepoFindUnique).toHaveBeenCalledWith({
        where: { userId: 'user-repo-1' },
      });
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });

    it('requireStarterRepo — no repo: next receives ApiError(409, "Create your starter repository before requesting a ticket")', async () => {
      starterRepoFindUnique.mockResolvedValue(null);
      const req = { user: { id: 'user-norepo-2', role: 'user' } };
      const res = mockRes();
      const next = vi.fn();

      await requireStarterRepo(req as never, res as never, next);

      expect(starterRepoFindUnique).toHaveBeenCalledWith({
        where: { userId: 'user-norepo-2' },
      });
      expect(next).toHaveBeenCalledTimes(1);
      const errorArg = next.mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(ApiError);
      expect(errorArg.statusCode).toBe(HTTP_STATUS.CONFLICT);
      expect(errorArg.statusCode).toBe(409);
      expect(errorArg.message).toBe(
        'Create your starter repository before requesting a ticket',
      );
    });

    it('requireStarterRepo — unauthenticated: returns 401 when req.user is missing', async () => {
      const req = {};
      const res = mockRes();
      const next = vi.fn();

      await requireStarterRepo(req as never, res as never, next);

      expect(starterRepoFindUnique).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
      const errorArg = next.mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(ApiError);
      expect(errorArg.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(errorArg.statusCode).toBe(401);
    });

    it('requireStarterRepo — forwards DB errors to next', async () => {
      const dbError = new Error('Database query failed');
      starterRepoFindUnique.mockRejectedValue(dbError);
      const req = { user: { id: 'user-err-repo', role: 'user' } };
      const res = mockRes();
      const next = vi.fn();

      await requireStarterRepo(req as never, res as never, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });
});
