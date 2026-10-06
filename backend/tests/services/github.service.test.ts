import { beforeEach, describe, expect, it, vi } from 'vitest';
import ApiError from '../../src/utils/ApiError.js';
import { HTTP_STATUS } from '../../src/constants/index.js';
import { encryptGitHubToken } from '../../src/lib/crypto/github-token.js';

const gitHubConnectionFindUnique = vi.fn();
const gitHubConnectionDelete = vi.fn();
const starterRepoFindUnique = vi.fn();
const starterRepoCreate = vi.fn();
const createBranch = vi.fn();
const createStarterRepository = vi.fn();
const getPullRequestAndDiff = vi.fn();

vi.mock('../../src/config/db.js', () => ({
  prisma: {
    gitHubConnection: {
      findUnique: gitHubConnectionFindUnique,
      delete: gitHubConnectionDelete,
    },
    starterRepo: {
      findUnique: starterRepoFindUnique,
      create: starterRepoCreate,
    },
  },
}));

vi.mock('../../src/integrations/github.js', () => ({
  createBranch,
  createStarterRepository,
  getPullRequestAndDiff,
}));

const {
  assertGitHubConnected,
  assertStarterRepo,
  createTicketBranch,
  getStarterRepoSummary,
  getGitHubConnection,
  disconnectGitHub,
  createStarterRepo,
  getBranchSubmissionState,
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
    const encryptedToken = encryptGitHubToken('github-token');
    gitHubConnectionFindUnique.mockResolvedValue({
      accessTokenEncrypted: encryptedToken,
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
      accessToken: 'github-token',
    });
  });

  it('createTicketBranch maps unknown errors to 502', async () => {
    const encryptedToken = encryptGitHubToken('github-token');
    gitHubConnectionFindUnique.mockResolvedValue({
      accessTokenEncrypted: encryptedToken,
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

  describe('getGitHubConnection', () => {
    it('returns connected: false and null repo if no connection exists', async () => {
      gitHubConnectionFindUnique.mockResolvedValue(null);
      starterRepoFindUnique.mockResolvedValue(null);

      const result = await getGitHubConnection('u1');
      expect(result).toEqual({
        connected: false,
        githubLogin: null,
        repo: null,
      });
    });

    it('returns connected: true and repo if both exist', async () => {
      gitHubConnectionFindUnique.mockResolvedValue({
        githubLogin: 'octocat',
      });
      starterRepoFindUnique.mockResolvedValue({
        fullName: 'octocat/work-simulator',
        starterTemplate: 'react',
        defaultBranch: 'main',
      });

      const result = await getGitHubConnection('u1');
      expect(result).toEqual({
        connected: true,
        githubLogin: 'octocat',
        repo: {
          fullName: 'octocat/work-simulator',
          starterTemplate: 'react',
          defaultBranch: 'main',
        },
      });
    });
  });

  describe('disconnectGitHub', () => {
    it('throws 404 if connection does not exist', async () => {
      gitHubConnectionFindUnique.mockResolvedValue(null);

      await expect(disconnectGitHub('u1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.NOT_FOUND,
      });
    });

    it('deletes connection record if found', async () => {
      gitHubConnectionFindUnique.mockResolvedValue({ id: 'conn-1' });
      gitHubConnectionDelete.mockResolvedValue({ id: 'conn-1' });

      await disconnectGitHub('u1');
      expect(gitHubConnectionDelete).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    });
  });

  describe('createStarterRepo', () => {
    it('throws 403 if GitHub is not connected', async () => {
      gitHubConnectionFindUnique.mockResolvedValue(null);

      await expect(createStarterRepo('u1', 'react')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.FORBIDDEN,
      });
    });

    it('throws 409 if starter repository already exists', async () => {
      gitHubConnectionFindUnique.mockResolvedValue({
        accessTokenEncrypted: encryptGitHubToken('token'),
      });
      starterRepoFindUnique.mockResolvedValue({ id: 'repo-1' });

      await expect(createStarterRepo('u1', 'react')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.CONFLICT,
      });
    });

    it('creates repository and persists starterRepo record without subscription', async () => {
      gitHubConnectionFindUnique.mockResolvedValue({
        accessTokenEncrypted: encryptGitHubToken('token'),
      });
      starterRepoFindUnique.mockResolvedValue(null);
      createStarterRepository.mockResolvedValue({
        githubRepoId: '12345',
        fullName: 'octocat/work-simulator',
        defaultBranch: 'main',
      });
      starterRepoCreate.mockResolvedValue({
        fullName: 'octocat/work-simulator',
        starterTemplate: 'react',
        defaultBranch: 'main',
      });

      const repo = await createStarterRepo('u1', 'react', 'work-simulator');

      expect(createStarterRepository).toHaveBeenCalled();
      expect(starterRepoCreate).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          starterTemplate: 'react',
          githubRepoId: '12345',
          fullName: 'octocat/work-simulator',
          defaultBranch: 'main',
        },
      });
      expect(repo).toEqual({
        fullName: 'octocat/work-simulator',
        starterTemplate: 'react',
        defaultBranch: 'main',
      });
    });
  });

  describe('getBranchSubmissionState', () => {
    it('throws 403 if GitHub is not connected', async () => {
      gitHubConnectionFindUnique.mockResolvedValue(null);

      await expect(getBranchSubmissionState('u1', 'ticket/react-1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.FORBIDDEN,
      });
    });

    it('throws 409 if starter repo does not exist', async () => {
      gitHubConnectionFindUnique.mockResolvedValue({
        accessTokenEncrypted: encryptGitHubToken('token'),
      });
      starterRepoFindUnique.mockResolvedValue(null);

      await expect(getBranchSubmissionState('u1', 'ticket/react-1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.CONFLICT,
      });
    });

    it('returns full submission state when PR and diff are found', async () => {
      gitHubConnectionFindUnique.mockResolvedValue({
        accessTokenEncrypted: encryptGitHubToken('token'),
      });
      starterRepoFindUnique.mockResolvedValue({
        fullName: 'octocat/work-simulator',
        defaultBranch: 'main',
      });
      getPullRequestAndDiff.mockResolvedValue({
        prNumber: 42,
        prUrl: 'https://github.com/octocat/work-simulator/pull/42',
        headSha: 'abc1234',
        diff: 'simulated diff',
      });

      const state = await getBranchSubmissionState('u1', 'ticket/react-1');

      expect(getPullRequestAndDiff).toHaveBeenCalledWith({
        owner: 'octocat',
        repo: 'work-simulator',
        branchName: 'ticket/react-1',
        defaultBranch: 'main',
        accessToken: 'token',
      });
      expect(state).toEqual({
        fullName: 'octocat/work-simulator',
        branchName: 'ticket/react-1',
        defaultBranch: 'main',
        prNumber: 42,
        prUrl: 'https://github.com/octocat/work-simulator/pull/42',
        headSha: 'abc1234',
        diff: 'simulated diff',
      });
    });
  });
});


