import { beforeEach, describe, expect, it, vi } from 'vitest';
import ApiError from '../../src/utils/ApiError.js';
import { HTTP_STATUS } from '../../src/constants/index.js';

const gitHubConnectionFindUnique = vi.fn();
const starterRepoFindUnique = vi.fn();
const createBranch = vi.fn();

vi.mock('../../src/config/db.js', () => ({
  prisma: {
    gitHubConnection: { findUnique: gitHubConnectionFindUnique },
    starterRepo: { findUnique: starterRepoFindUnique },
  },
}));

vi.mock('../../src/integrations/github.js', () => ({
  createBranch,
}));

const {
  assertGitHubConnected,
  assertStarterRepo,
  createTicketBranch,
  getStarterRepoSummary,
} = await import('../../src/services/github.service.js');

describe('github.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('assertGitHubConnected throws 403 when missing', async () => {
    gitHubConnectionFindUnique.mockResolvedValue(null);
    await expect(assertGitHubConnected('u1')).rejects.toMatchObject({
      statusCode: HTTP_STATUS.FORBIDDEN,
    });
  });

  it('assertStarterRepo throws 409 when missing', async () => {
    starterRepoFindUnique.mockResolvedValue(null);
    await expect(assertStarterRepo('u1')).rejects.toMatchObject({
      statusCode: HTTP_STATUS.CONFLICT,
      message: 'Create your starter repository before requesting a ticket',
    });
  });

  it('createTicketBranch delegates to the integration', async () => {
    gitHubConnectionFindUnique.mockResolvedValue({
      accessTokenEncrypted: 'enc',
    });
    starterRepoFindUnique.mockResolvedValue({
      fullName: 'ada/starter',
      defaultBranch: 'main',
    });
    createBranch.mockResolvedValue(undefined);

    await createTicketBranch('u1', 'ticket/x', 'main');

    expect(createBranch).toHaveBeenCalledWith({
      owner: 'ada',
      repo: 'starter',
      branchName: 'ticket/x',
      baseBranch: 'main',
      accessToken: 'enc',
    });
  });

  it('createTicketBranch maps unknown errors to 502', async () => {
    gitHubConnectionFindUnique.mockResolvedValue({
      accessTokenEncrypted: 'enc',
    });
    starterRepoFindUnique.mockResolvedValue({
      fullName: 'ada/starter',
      defaultBranch: 'main',
    });
    createBranch.mockRejectedValue(new Error('network'));

    await expect(createTicketBranch('u1', 'ticket/x', 'main')).rejects.toBeInstanceOf(
      ApiError,
    );
    await expect(createTicketBranch('u1', 'ticket/x', 'main')).rejects.toMatchObject({
      statusCode: HTTP_STATUS.BAD_GATEWAY,
    });
  });

  it('getStarterRepoSummary returns null when absent', async () => {
    starterRepoFindUnique.mockResolvedValue(null);
    await expect(getStarterRepoSummary('u1')).resolves.toBeNull();
  });
});
