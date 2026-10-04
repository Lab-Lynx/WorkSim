import { prisma } from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import type { GitHubSubmissionState } from '../types/domain.js';
import * as githubApi from '../integrations/github.js';
import { hasPaidAccess } from './subscription.service.js';
import {
  createOAuthState,
  verifyOAuthState,
  OAuthStateError,
} from '../lib/github/oauth-state.js';
import {
  encryptGitHubToken,
  decryptGitHubToken,
} from '../lib/encryption/github-token.js';
import { StarterTemplate } from '@prisma/client';

const GITHUB_NOT_CONNECTED = 'GitHub is not connected. Connect GitHub to continue';
const BRANCH_CREATE_FAILED =
  'Could not create the ticket branch on GitHub, please try again';
const PR_READ_FAILED =
  'Could not read your pull request from GitHub, please try again';

const REQUESTED_SCOPES = ['repo', 'write:repo_hook'];

const TEMPLATE_REPO_MAP: Record<string, { owner: string; repo: string }> = {
  react: { owner: 'Lab-Lynx', repo: 'react-starter' },
  node_express: { owner: 'Lab-Lynx', repo: 'node-express-starter' },
  django: { owner: 'Lab-Lynx', repo: 'django-practice-starter' },
};

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
 * EP-18: create GitHub OAuth authorization URL
 */
export async function createGitHubAuthorizeUrl(userId: string): Promise<string> {
  if (!(await hasPaidAccess(userId))) {
    throw new ApiError(HTTP_STATUS.PAYMENT_REQUIRED, 'An active subscription is required');
  }

  const clientId = process.env.GITHUB_CLIENT_ID || process.env.GITHUB_OAUTH_CLIENT_ID || '';
  const state = createOAuthState(userId);
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', REQUESTED_SCOPES.join(' '));
  url.searchParams.set('state', state);
  return url.toString();
}

/**
 * EP-19: handle GitHub OAuth callback
 */
export async function handleGitHubCallback(
  userId: string,
  code: string,
  state: string,
): Promise<void> {
  try {
    verifyOAuthState(state, userId);
  } catch (err) {
    if (err instanceof OAuthStateError) {
      throw new GitHubCallbackError('state_invalid', 'Invalid or expired OAuth state');
    }
    throw err;
  }

  let tokenResult: { accessToken: string; scope: string };
  try {
    tokenResult = await githubApi.exchangeCodeForToken(code);
  } catch {
    throw new GitHubCallbackError('exchange_failed', 'Failed to exchange code for token');
  }

  const grantedScopes = new Set(tokenResult.scope.split(/[, ]+/).filter(Boolean));
  const requestedScopes = new Set(REQUESTED_SCOPES);
  const hasExtraScope = [...grantedScopes].some((s) => !requestedScopes.has(s));
  if (hasExtraScope) {
    throw new GitHubCallbackError('scope_invalid', 'Granted scope exceeds requested scope');
  }

  const identity = await githubApi.getAuthenticatedUser(tokenResult.accessToken);
  const encryptedToken = encryptGitHubToken(tokenResult.accessToken);

  await prisma.gitHubConnection.upsert({
    where: { userId },
    update: {
      accessTokenEncrypted: encryptedToken,
      scope: tokenResult.scope,
      githubLogin: identity.login,
      githubUserId: String(identity.id),
    },
    create: {
      userId,
      accessTokenEncrypted: encryptedToken,
      scope: tokenResult.scope,
      githubLogin: identity.login,
      githubUserId: String(identity.id),
    },
  });
}

/**
 * EP-20: read GitHub connection and starter repo
 */
export async function getGitHubConnection(userId: string): Promise<{
  connected: boolean;
  githubLogin: string | null;
  repo: { fullName: string; starterTemplate: string; defaultBranch: string } | null;
}> {
  const connection = await prisma.gitHubConnection.findUnique({ where: { userId } });
  const repo = await prisma.starterRepo.findUnique({ where: { userId } });

  return {
    connected: !!connection,
    githubLogin: connection?.githubLogin ?? null,
    repo: repo
      ? {
          fullName: repo.fullName,
          starterTemplate: repo.starterTemplate,
          defaultBranch: repo.defaultBranch,
        }
      : null,
  };
}

/**
 * EP-21: disconnect GitHub
 */
export async function disconnectGitHub(userId: string): Promise<void> {
  const connection = await prisma.gitHubConnection.findUnique({ where: { userId } });
  if (!connection) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GitHub is not connected');
  }
  await prisma.gitHubConnection.delete({ where: { userId } });
}

function isNameCollision(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const errorObj = err as { status?: number; message?: string; cause?: { status?: number } };
  return (
    errorObj.status === 422 ||
    errorObj.message?.includes('already exists') === true ||
    errorObj.cause?.status === 422
  );
}

/**
 * EP-22: create starter repository from template
 */
export async function createStarterRepo(
  userId: string,
  starterTemplate: string,
  repoName = 'work-simulator',
): Promise<{ fullName: string; starterTemplate: string; defaultBranch: string }> {
  if (!TEMPLATE_REPO_MAP[starterTemplate]) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Unsupported starter template');
  }
  if (!(await hasPaidAccess(userId))) {
    throw new ApiError(HTTP_STATUS.PAYMENT_REQUIRED, 'An active subscription is required');
  }

  const connection = await prisma.gitHubConnection.findUnique({ where: { userId } });
  if (!connection) {
    throw new ApiError(
      HTTP_STATUS.FORBIDDEN,
      'GitHub is not connected. Connect GitHub to continue',
    );
  }

  const existingRepo = await prisma.starterRepo.findUnique({ where: { userId } });
  if (existingRepo) {
    throw new ApiError(HTTP_STATUS.CONFLICT, 'You already have a starter repository');
  }

  const accessToken = decryptGitHubToken(connection.accessTokenEncrypted);
  const template = TEMPLATE_REPO_MAP[starterTemplate];

  let created: { repoId: string; fullName: string; defaultBranch: string };
  try {
    created = await githubApi.createRepoFromTemplate({
      accessToken,
      templateOwner: template.owner,
      templateRepo: template.repo,
      name: repoName,
    });
  } catch (err) {
    if (err instanceof githubApi.GitHubTokenInvalidError) {
      await prisma.gitHubConnection.delete({ where: { userId } });
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Your GitHub connection is no longer valid. Reconnect GitHub to continue',
      );
    }
    if (isNameCollision(err)) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        `A repository named '${repoName}' already exists in your GitHub account. Choose another name or delete it, then try again`,
      );
    }
    throw new ApiError(
      HTTP_STATUS.BAD_GATEWAY,
      'GitHub could not create the repository, please try again',
    );
  }

  const [owner] = created.fullName.split('/');
  const webhookUrl = process.env.GITHUB_WEBHOOK_URL;
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (webhookUrl && webhookSecret) {
    try {
      await githubApi.registerWorkflowWebhook({
        accessToken,
        owner,
        repo: repoName,
        webhookUrl,
        webhookSecret,
      });
    } catch {
      throw new ApiError(
        HTTP_STATUS.BAD_GATEWAY,
        'GitHub could not finish setting up the repository, please try again',
      );
    }
  }

  return prisma.starterRepo.create({
    data: {
      userId,
      starterTemplate: starterTemplate as StarterTemplate,
      githubRepoId: created.repoId,
      fullName: created.fullName,
      defaultBranch: created.defaultBranch,
    },
  });
}

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
    await githubApi.createBranch({
      owner,
      repo: repoName,
      branchName,
      baseBranch: baseBranch || repo.defaultBranch,
      accessToken: connection.accessTokenEncrypted,
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

  const accessToken = decryptGitHubToken(connection.accessTokenEncrypted);
  const [owner, repoName] = repo.fullName.split('/');

  let pr: { prNumber: number; prUrl: string; headSha: string };
  try {
    pr = await githubApi.findOrCreatePullRequest({
      accessToken,
      owner,
      repo: repoName,
      branchName,
      baseBranch: repo.defaultBranch,
    });
  } catch (err) {
    if (err instanceof githubApi.GitHubTokenInvalidError) {
      await prisma.gitHubConnection.delete({ where: { userId } });
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Your GitHub connection is no longer valid. Reconnect GitHub to continue',
      );
    }
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, PR_READ_FAILED);
  }

  let diff: string;
  try {
    diff = await githubApi.getPullRequestDiff({
      accessToken,
      owner,
      repo: repoName,
      prNumber: pr.prNumber,
    });
  } catch {
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, PR_READ_FAILED);
  }

  if (!diff || diff.trim().length === 0) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      `No commits found on branch '${branchName}'. Push your work before submitting`,
    );
  }

  return {
    fullName: repo.fullName,
    branchName,
    defaultBranch: repo.defaultBranch,
    prNumber: pr.prNumber,
    prUrl: pr.prUrl,
    headSha: pr.headSha,
    diff,
  };
};
