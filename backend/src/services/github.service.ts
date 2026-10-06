import { randomBytes } from 'node:crypto';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { StarterTemplate } from '@prisma/client';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import logger from '../utils/logger.js';
import type {
  GitHubConnectionSummary,
  GitHubSubmissionState,
  RepoSummary,
} from '../types/domain.js';
import * as githubIntegration from '../integrations/github.js';
import { decryptGitHubToken, encryptGitHubToken } from '../lib/crypto/github-token.js';
import { hashToken } from '../lib/crypto/token-hash.js';

const GITHUB_NOT_CONNECTED = 'GitHub is not connected. Connect GitHub to continue';
const BRANCH_CREATE_FAILED =
  'Could not create the ticket branch on GitHub, please try again';
const PR_READ_FAILED =
  'Could not read your pull request from GitHub, please try again';

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export type GitHubCallbackFailure = 'state_invalid' | 'scope_invalid' | 'exchange_failed';

export class GitHubCallbackError extends Error {
  constructor(
    readonly category: GitHubCallbackFailure,
    message: string,
  ) {
    super(message);
    this.name = 'GitHubCallbackError';
  }
}

const frontendOAuthRedirect = (status: 'connected' | 'error', reason?: string): string => {
  const url = new URL('/github', env.CLIENT_URL);
  url.searchParams.set('github', status);
  if (reason) url.searchParams.set('reason', reason);
  return url.toString();
};

export const createGitHubAuthorization = async (userId: string): Promise<string> => {
  const state = randomBytes(32).toString('base64url');
  await prisma.gitHubOAuthState.create({
    data: {
      userId,
      stateHash: hashToken(state),
      expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS),
    },
  });
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  url.searchParams.set('redirect_uri', env.GITHUB_CALLBACK_URL);
  url.searchParams.set(
    'scope',
    env.GITHUB_REQUESTED_SCOPE
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' '),
  );
  url.searchParams.set('state', state);
  return url.toString();
};

export const createGitHubAuthorizeUrl = createGitHubAuthorization;

export const completeGitHubAuthorization = async (
  state: string | undefined,
  code: string | undefined,
): Promise<string> => {
  if (!state || !code) return frontendOAuthRedirect('error', 'state_invalid');
  const claimed = await prisma.gitHubOAuthState.updateMany({
    where: {
      stateHash: hashToken(state),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return frontendOAuthRedirect('error', 'state_invalid');

  try {
    const oauthState = await prisma.gitHubOAuthState.findUniqueOrThrow({
      where: { stateHash: hashToken(state) },
      select: { userId: true },
    });
    const identity = await githubIntegration.exchangeOAuthCode(code);
    await prisma.gitHubConnection.upsert({
      where: { userId: oauthState.userId },
      create: {
        userId: oauthState.userId,
        githubUserId: identity.githubUserId,
        githubLogin: identity.githubLogin,
        accessTokenEncrypted: encryptGitHubToken(identity.accessToken),
        scope: identity.scope,
      },
      update: {
        githubUserId: identity.githubUserId,
        githubLogin: identity.githubLogin,
        accessTokenEncrypted: encryptGitHubToken(identity.accessToken),
        scope: identity.scope,
      },
    });
    return frontendOAuthRedirect('connected');
  } catch (error) {
    logger.warn(
      { message: error instanceof Error ? error.message : 'unknown error' },
      'GitHub OAuth callback failed',
    );
    if (error instanceof ApiError && error.message.includes('scope')) {
      return frontendOAuthRedirect('error', 'scope_invalid');
    }
    return frontendOAuthRedirect('error', 'exchange_failed');
  }
};
export async function handleGitHubCallback(
  _userId: string,
  code: string,
  state: string,
): Promise<void> {
  const result = await completeGitHubAuthorization(state, code);
  if (result.includes('error')) {
    throw new GitHubCallbackError('exchange_failed', 'GitHub OAuth callback failed');
  }
}

export const assertGitHubConnected = async (userId: string): Promise<void> => {
  const connection = await prisma.gitHubConnection.findUnique({ where: { userId } });
  if (!connection) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, GITHUB_NOT_CONNECTED);
  }
};

export const assertStarterRepo = async (userId: string) => {
  const repo = await prisma.starterRepo.findUnique({ where: { userId } });
  if (!repo) {
    throw new ApiError(
      HTTP_STATUS.CONFLICT,
      'Create your starter repository before requesting a ticket',
    );
  }
  return repo;
};

/** Read-only repo summary for Ticket serialization (may be null). */
export const getStarterRepoSummary = async (
  userId: string,
): Promise<{ fullName: string; defaultBranch: string } | null> => {
  return prisma.starterRepo.findUnique({
    where: { userId },
    select: { fullName: true, defaultBranch: true },
  });
};

/**
 * Return connection status and existing starter repo (EP-20 / Doc 8 getGitHubConnection).
 */
export const getGitHubConnection = async (
  userId: string,
): Promise<GitHubConnectionSummary> => {
  const [connection, starterRepo] = await Promise.all([
    prisma.gitHubConnection.findUnique({
      where: { userId },
      select: { githubLogin: true },
    }),
    prisma.starterRepo.findUnique({
      where: { userId },
      select: {
        fullName: true,
        starterTemplate: true,
        defaultBranch: true,
      },
    }),
  ]);

  return {
    connected: connection !== null,
    githubLogin: connection?.githubLogin ?? null,
    repo: starterRepo
      ? {
          fullName: starterRepo.fullName,
          starterTemplate: starterRepo.starterTemplate,
          defaultBranch: starterRepo.defaultBranch,
        }
      : null,
  };
};

/**
 * Disconnect GitHub by deleting the platform's GitHubConnection row (EP-21 / Doc 8 disconnectGitHub).
 */
export const disconnectGitHub = async (userId: string): Promise<void> => {
  const connection = await prisma.gitHubConnection.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!connection) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GitHub is not connected');
  }

  await prisma.gitHubConnection.delete({ where: { userId } });
};

/**
 * Create starter repository from template in user's GitHub account (EP-22 / Doc 8 createStarterRepo).
 */
export const createStarterRepo = async (
  userId: string,
  starterTemplate: StarterTemplate | string,
  repoName: string = 'work-simulator',
): Promise<RepoSummary> => {
  const connection = await prisma.gitHubConnection.findUnique({
    where: { userId },
  });

  if (!connection) {
    throw new ApiError(
      HTTP_STATUS.FORBIDDEN,
      'GitHub is not connected. Connect GitHub to continue',
    );
  }

  const existingRepo = await prisma.starterRepo.findUnique({
    where: { userId },
  });
  if (existingRepo) {
    throw new ApiError(
      HTTP_STATUS.CONFLICT,
      'You already have a starter repository',
    );
  }

  const accessToken = decryptGitHubToken(connection.accessTokenEncrypted);
  const webhookUrl = `${env.CLIENT_URL.replace(/\/+$/, '')}/api/v1/webhooks/github`;

  let repoResult;
  try {
    repoResult = await githubIntegration.createStarterRepository({
      starterTemplate,
      repoName: repoName || 'work-simulator',
      accessToken,
      webhookUrl,
      webhookSecret: env.GITHUB_WEBHOOK_SECRET,
    });
  } catch (err: unknown) {
    if (err instanceof ApiError && err.statusCode === HTTP_STATUS.FORBIDDEN) {
      await prisma.gitHubConnection.delete({ where: { userId } }).catch(() => {});
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Your GitHub connection is no longer valid. Reconnect GitHub to continue',
      );
    }
    throw err;
  }

  try {
    const created = await prisma.starterRepo.create({
      data: {
        userId,
        starterTemplate: starterTemplate as StarterTemplate,
        githubRepoId: repoResult.githubRepoId,
        fullName: repoResult.fullName,
        defaultBranch: repoResult.defaultBranch,
      },
    });

    return {
      fullName: created.fullName,
      starterTemplate: created.starterTemplate,
      defaultBranch: created.defaultBranch,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error({ err: error }, 'Failed to persist starter repo to database');
    throw new ApiError(
      HTTP_STATUS.BAD_GATEWAY,
      'GitHub could not create the repository, please try again',
    );
  }
};

/**
 * Create the ticket branch on the user's starter repo (Doc 8 createTicketBranch).
 * Looks up connection + repo; delegates the API call to integrations/github.
 */
export const createTicketBranch = async (
  userId: string,
  branchName: string,
  baseBranch: string,
): Promise<void> => {
  const connection = await prisma.gitHubConnection.findUnique({ where: { userId } });
  if (!connection) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, GITHUB_NOT_CONNECTED);
  }

  const repo = await prisma.starterRepo.findUnique({ where: { userId } });
  if (!repo) {
    throw new ApiError(
      HTTP_STATUS.CONFLICT,
      'Create your starter repository before requesting a ticket',
    );
  }

  const [owner, repoName] = repo.fullName.split('/');
  if (!owner || !repoName) {
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, BRANCH_CREATE_FAILED);
  }

  try {
    const accessToken = decryptGitHubToken(connection.accessTokenEncrypted);
    await githubIntegration.createBranch({
      owner,
      repo: repoName,
      branchName,
      baseBranch: baseBranch || repo.defaultBranch,
      accessToken,
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, BRANCH_CREATE_FAILED);
  }
};

/**
 * Read branch/PR/diff for submitWork (Doc 8 getBranchSubmissionState).
 */
export const getBranchSubmissionState = async (
  userId: string,
  branchName: string,
): Promise<GitHubSubmissionState> => {
  const connection = await prisma.gitHubConnection.findUnique({ where: { userId } });
  if (!connection) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, GITHUB_NOT_CONNECTED);
  }

  const repo = await prisma.starterRepo.findUnique({ where: { userId } });
  if (!repo) {
    throw new ApiError(
      HTTP_STATUS.CONFLICT,
      'Create your starter repository before requesting a ticket',
    );
  }

  const [owner, repoName] = repo.fullName.split('/');
  if (!owner || !repoName) {
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, PR_READ_FAILED);
  }

  const accessToken = decryptGitHubToken(connection.accessTokenEncrypted);
  let prResult;
  try {
    prResult = await githubIntegration.getPullRequestAndDiff({
      owner,
      repo: repoName,
      branchName,
      defaultBranch: repo.defaultBranch,
      accessToken,
    });
  } catch (err: unknown) {
    if (err instanceof ApiError && err.statusCode === HTTP_STATUS.FORBIDDEN) {
      await prisma.gitHubConnection.delete({ where: { userId } }).catch(() => {});
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Your GitHub connection is no longer valid. Reconnect GitHub to continue',
      );
    }
    throw err;
  }

  return {
    fullName: repo.fullName,
    branchName,
    defaultBranch: repo.defaultBranch,
    prNumber: prResult.prNumber,
    prUrl: prResult.prUrl,
    headSha: prResult.headSha,
    diff: prResult.diff,
  };
};
