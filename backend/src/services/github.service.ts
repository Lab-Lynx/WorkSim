import { prisma } from '../lib/prisma';
import { ApiError } from '../lib/errors/ApiError';
import { hasPaidAccess } from './subscription.service';
import { encryptGitHubToken, decryptGitHubToken } from '../lib/encryption/github-token';
import { createOAuthState, verifyOAuthState, OAuthStateError } from '../lib/github/oauth-state';
import {
  exchangeCodeForToken,
  getAuthenticatedUser,
  createRepoFromTemplate,
  registerWorkflowWebhook,
  createBranch,
  findOrCreatePullRequest,
  getPullRequestDiff,
  GitHubTokenInvalidError,
  GitHubProviderError,
} from '../integrations/github';

const REQUESTED_SCOPES = ['public_repo', 'write:repo_hook'];

const TEMPLATE_REPO_MAP: Record<string, { owner: string; repo: string }> = {
  react: { owner: 'Lab-Lynx', repo: 'react-starter' },
  node_express: { owner: 'Lab-Lynx', repo: 'node-express-starter' },
  django: { owner: 'Lab-Lynx', repo: 'django-practice-starter' },
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function isNameCollision(err: unknown): boolean {
  return err instanceof GitHubProviderError && (err.cause as any)?.status === 422;
}

// ---- EP-18 ----
export async function createGitHubAuthorizeUrl(userId: string): Promise<string> {
  if (!(await hasPaidAccess(userId))) {
    throw new ApiError(402, 'An active subscription is required');
  }

  const state = createOAuthState(userId);
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', requireEnv('GITHUB_OAUTH_CLIENT_ID'));
  url.searchParams.set('scope', REQUESTED_SCOPES.join(' '));
  url.searchParams.set('state', state);
  return url.toString();
}

// ---- EP-19 ----
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

export async function handleGitHubCallback(
  userId: string,
  code: string,
  state: string,
): Promise<void> {
  try {
    verifyOAuthState(state, userId);
  } catch (err) {
    if (err instanceof OAuthStateError)
      throw new GitHubCallbackError('state_invalid', 'Invalid or expired OAuth state');
    throw err;
  }

  let tokenResult: { accessToken: string; scope: string };
  try {
    tokenResult = await exchangeCodeForToken(code);
  } catch {
    throw new GitHubCallbackError('exchange_failed', 'Failed to exchange code for token');
  }

  const grantedScopes = new Set(tokenResult.scope.split(/[, ]+/).filter(Boolean));
  const requestedScopes = new Set(REQUESTED_SCOPES);
  const hasExtraScope = [...grantedScopes].some((s) => !requestedScopes.has(s));
  if (hasExtraScope) {
    throw new GitHubCallbackError('scope_invalid', 'Granted scope exceeds requested scope');
  }

  const identity = await getAuthenticatedUser(tokenResult.accessToken);
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

  // Note: Q-16 (what happens if the user clicks "Cancel" on GitHub's consent
  // screen) is explicitly NOT handled here. GitHub never calls this callback
  // with a code in that case — it redirects with an `error=access_denied`
  // query param instead, which the controller handles before this function
  // is ever invoked. Do not add an access_denied case to this function.
}

// ---- EP-20 ----
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

// ---- EP-21 ----
export async function disconnectGitHub(userId: string): Promise<void> {
  const connection = await prisma.gitHubConnection.findUnique({ where: { userId } });
  if (!connection) throw new ApiError(404, 'GitHub is not connected');
  await prisma.gitHubConnection.delete({ where: { userId } });
  // StarterRepo, tickets, submissions are deliberately untouched (A-07).
  // Does not revoke the grant at GitHub itself (A-32).
}

// ---- EP-22 ----
export async function createStarterRepo(
  userId: string,
  starterTemplate: string,
  repoName = 'work-simulator',
): Promise<{ fullName: string; starterTemplate: string; defaultBranch: string }> {
  if (!TEMPLATE_REPO_MAP[starterTemplate]) {
    throw new ApiError(400, 'Unsupported starter template');
  }
  if (!(await hasPaidAccess(userId))) {
    throw new ApiError(402, 'An active subscription is required');
  }

  const connection = await prisma.gitHubConnection.findUnique({ where: { userId } });
  if (!connection) throw new ApiError(403, 'GitHub is not connected. Connect GitHub to continue');

  const existingRepo = await prisma.starterRepo.findUnique({ where: { userId } });
  if (existingRepo) throw new ApiError(409, 'You already have a starter repository');

  const accessToken = decryptGitHubToken(connection.accessTokenEncrypted);
  const template = TEMPLATE_REPO_MAP[starterTemplate];

  let created;
  try {
    created = await createRepoFromTemplate({
      accessToken,
      templateOwner: template.owner,
      templateRepo: template.repo,
      name: repoName,
    });
  } catch (err) {
    if (err instanceof GitHubTokenInvalidError) {
      await prisma.gitHubConnection.delete({ where: { userId } });
      throw new ApiError(
        403,
        'Your GitHub connection is no longer valid. Reconnect GitHub to continue',
      );
    }
    if (isNameCollision(err)) {
      // D-13: exact 409, no auto-suffix — the user chooses a new name themselves.
      throw new ApiError(
        409,
        `A repository named '${repoName}' already exists in your GitHub account. Choose another name or delete it, then try again`,
      );
    }
    throw new ApiError(502, 'GitHub could not create the repository, please try again');
  }

  const [owner] = created.fullName.split('/');

  try {
    await registerWorkflowWebhook({
      accessToken,
      owner,
      repo: repoName,
      webhookUrl: requireEnv('GITHUB_WEBHOOK_URL'),
      webhookSecret: requireEnv('GITHUB_WEBHOOK_SECRET'),
    });
  } catch {
    // Explicit requirement: never report success if the webhook fails,
    // and never save a StarterRepo row for a repo that isn't fully set up.
    throw new ApiError(502, 'GitHub could not finish setting up the repository, please try again');
  }

  return prisma.starterRepo.create({
    data: {
      userId,
      starterTemplate,
      githubRepoId: created.repoId,
      fullName: created.fullName,
      defaultBranch: created.defaultBranch,
    },
  });
}

// ---- Used by ticket assignment (EP-23) ----
export async function createTicketBranch(
  userId: string,
  branchName: string,
  baseBranch: string,
): Promise<void> {
  const connection = await prisma.gitHubConnection.findUnique({ where: { userId } });
  if (!connection) throw new ApiError(403, 'GitHub is not connected. Connect GitHub to continue');

  const repo = await prisma.starterRepo.findUnique({ where: { userId } });
  if (!repo) throw new ApiError(409, 'Create your starter repository before requesting a ticket');

  const accessToken = decryptGitHubToken(connection.accessTokenEncrypted);
  const [owner, repoName] = repo.fullName.split('/');

  try {
    await createBranch({ accessToken, owner, repo: repoName, branchName, baseBranch });
  } catch (err) {
    if (err instanceof GitHubTokenInvalidError) {
      await prisma.gitHubConnection.delete({ where: { userId } });
      throw new ApiError(
        403,
        'Your GitHub connection is no longer valid. Reconnect GitHub to continue',
      );
    }
    throw new ApiError(502, 'Could not create the ticket branch on GitHub, please try again');
  }
}

// ---- Used by submission (EP-30) ----
export async function getBranchSubmissionState(
  userId: string,
  branchName: string,
): Promise<{
  prNumber: number;
  prUrl: string;
  headSha: string;
  diff: string;
}> {
  const connection = await prisma.gitHubConnection.findUnique({ where: { userId } });
  if (!connection) throw new ApiError(403, 'GitHub is not connected. Connect GitHub to continue');

  const repo = await prisma.starterRepo.findUnique({ where: { userId } });
  if (!repo) throw new ApiError(409, 'Create your starter repository before requesting a ticket');

  const accessToken = decryptGitHubToken(connection.accessTokenEncrypted);
  const [owner, repoName] = repo.fullName.split('/');

  let pr;
  try {
    pr = await findOrCreatePullRequest({
      accessToken,
      owner,
      repo: repoName,
      branchName,
      baseBranch: repo.defaultBranch,
    });
  } catch (err) {
    if (err instanceof GitHubTokenInvalidError) {
      await prisma.gitHubConnection.delete({ where: { userId } });
      throw new ApiError(
        403,
        'Your GitHub connection is no longer valid. Reconnect GitHub to continue',
      );
    }
    throw new ApiError(502, 'Could not read your pull request from GitHub, please try again');
  }

  let diff: string;
  try {
    diff = await getPullRequestDiff({ accessToken, owner, repo: repoName, prNumber: pr.prNumber });
  } catch {
    throw new ApiError(502, 'Could not read your pull request from GitHub, please try again');
  }

  if (!diff || diff.trim().length === 0) {
    throw new ApiError(
      400,
      `No commits found on branch '${branchName}'. Push your work before submitting`,
    );
  }

  return { prNumber: pr.prNumber, prUrl: pr.prUrl, headSha: pr.headSha, diff };
}
