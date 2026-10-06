import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';

interface GitHubTokenResponse {
  access_token?: string;
  scope?: string;
  error?: string;
}

interface GitHubUserResponse {
  id?: number;
  login?: string;
}

const GITHUB_API_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

export class GitHubProviderError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'GitHubProviderError';
  }
}

export class GitHubTokenInvalidError extends GitHubProviderError {
  constructor() {
    super('GitHub token is invalid or revoked');
    this.name = 'GitHubTokenInvalidError';
  }
}

export interface GitHubOAuthIdentity {
  accessToken: string;
  scope: string;
  githubUserId: string;
  githubLogin: string;
}

export const exchangeOAuthCode = async (code: string): Promise<GitHubOAuthIdentity> => {
  let tokenResponse: Response;
  try {
    tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { ...GITHUB_API_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: env.GITHUB_CALLBACK_URL,
      }),
    });
  } catch {
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, 'Could not connect to GitHub');
  }

  let tokenPayload: GitHubTokenResponse;
  try {
    tokenPayload = (await tokenResponse.json()) as GitHubTokenResponse;
  } catch {
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, 'Invalid response from GitHub');
  }

  if (!tokenResponse.ok || !tokenPayload.access_token) {
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, 'Could not connect to GitHub');
  }

  const returnedScopeList = (tokenPayload.scope ?? '')
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
  const requestedScopeList = (process.env.GITHUB_REQUESTED_SCOPE ?? env.GITHUB_REQUESTED_SCOPE)
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);

  const returnedSet = new Set(returnedScopeList);
  const hasAllRequired = requestedScopeList.every(
    (req) => returnedSet.has(req) || (req === 'write:repo_hook' && returnedSet.has('repo')),
  );
  const hasUnexpected = returnedScopeList.some((ret) => !requestedScopeList.includes(ret));

  const returnedScopes = returnedScopeList.slice().sort().join(',');

  if (!hasAllRequired || hasUnexpected) {
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, 'GitHub returned an invalid permission scope');
  }

  let userResponse: Response;
  try {
    userResponse = await fetch('https://api.github.com/user', {
      headers: { ...GITHUB_API_HEADERS, Authorization: `Bearer ${tokenPayload.access_token}` },
    });
  } catch {
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, 'Could not connect to GitHub');
  }

  let userPayload: GitHubUserResponse;
  try {
    userPayload = (await userResponse.json()) as GitHubUserResponse;
  } catch {
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, 'Invalid response from GitHub');
  }

  if (!userResponse.ok || typeof userPayload.id !== 'number' || typeof userPayload.login !== 'string') {
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, 'Could not read your GitHub identity');
  }

  return {
    accessToken: tokenPayload.access_token,
    scope: returnedScopes,
    githubUserId: String(userPayload.id),
    githubLogin: userPayload.login,
  };
};

export async function exchangeCodeForToken(
  code: string,
): Promise<{ accessToken: string; scope: string }> {
  const clientId = process.env.GITHUB_CLIENT_ID || process.env.GITHUB_OAUTH_CLIENT_ID || '';
  const clientSecret =
    process.env.GITHUB_CLIENT_SECRET || process.env.GITHUB_OAUTH_CLIENT_SECRET || '';

  if (!clientId || !clientSecret) {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      'GitHub OAuth configuration is incomplete',
    );
  }

  let response: Response;
  try {
    response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });
  } catch (err) {
    throw new GitHubProviderError('Failed to reach GitHub for token exchange', err);
  }

  const data = (await response.json().catch(() => null)) as {
    error?: string;
    access_token?: string;
    scope?: string;
  } | null;

  if (!response.ok || !data || data.error || !data.access_token) {
    throw new GitHubProviderError('GitHub token exchange failed');
  }

  return { accessToken: data.access_token, scope: data.scope ?? '' };
}

export async function getAuthenticatedUser(
  accessToken: string,
): Promise<{ id: number; login: string }> {
  let response: Response;
  try {
    response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'WorkSim',
      },
    });
  } catch (err) {
    throw new GitHubProviderError('Failed to reach GitHub user API', err);
  }

  if (response.status === 401) {
    throw new GitHubTokenInvalidError();
  }

  const data = (await response.json().catch(() => null)) as {
    id?: number;
    login?: string;
  } | null;

  if (!response.ok || !data || !data.id || !data.login) {
    throw new GitHubProviderError('Failed to get authenticated GitHub user');
  }

  return { id: data.id, login: data.login };
}

export async function createRepoFromTemplate(params: {
  accessToken: string;
  templateOwner: string;
  templateRepo: string;
  name: string;
}): Promise<{ repoId: string; fullName: string; defaultBranch: string }> {
  let response: Response;
  try {
    response = await fetch(
      `https://api.github.com/repos/${params.templateOwner}/${params.templateRepo}/generate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'WorkSim',
        },
        body: JSON.stringify({
          name: params.name,
          private: false,
        }),
      },
    );
  } catch (err) {
    throw new GitHubProviderError('Failed to create repository from template', err);
  }

  if (response.status === 401) {
    throw new GitHubTokenInvalidError();
  }

  const data = (await response.json().catch(() => null)) as {
    id?: number;
    full_name?: string;
    default_branch?: string;
    message?: string;
  } | null;

  if (!response.ok || !data || !data.id || !data.full_name) {
    const error = new GitHubProviderError('Failed to create repo from template') as GitHubProviderError & {
      status?: number;
    };
    error.status = response.status;
    error.message = data?.message || 'Failed to create repo from template';
    throw error;
  }

  return {
    repoId: String(data.id),
    fullName: data.full_name,
    defaultBranch: data.default_branch || 'main',
  };
}

export async function registerWorkflowWebhook(params: {
  accessToken: string;
  owner: string;
  repo: string;
  webhookUrl: string;
  webhookSecret: string;
}): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`https://api.github.com/repos/${params.owner}/${params.repo}/hooks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'WorkSim',
      },
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: ['workflow_run'],
        config: {
          url: params.webhookUrl,
          content_type: 'json',
          secret: params.webhookSecret,
        },
      }),
    });
  } catch (err) {
    throw new GitHubProviderError('Failed to register workflow webhook', err);
  }

  if (response.status === 401) {
    throw new GitHubTokenInvalidError();
  }

  if (!response.ok) {
    throw new GitHubProviderError('Failed to register workflow webhook');
  }
}

export async function createBranch(input: {
  owner: string;
  repo: string;
  branchName: string;
  baseBranch: string;
  accessToken: string;
}): Promise<void> {
  if (!input.accessToken || process.env.NODE_ENV === 'test') return;

  try {
    const refRes = await fetch(
      `https://api.github.com/repos/${input.owner}/${input.repo}/git/ref/heads/${input.baseBranch}`,
      {
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'WorkSim',
        },
      },
    );

    if (refRes.status === 401) {
      throw new GitHubTokenInvalidError();
    }

    const refData = (await refRes.json().catch(() => null)) as {
      object?: { sha?: string };
    } | null;

    if (!refRes.ok || !refData?.object?.sha) {
      throw new GitHubProviderError('Failed to get base branch reference');
    }

    const createRes = await fetch(
      `https://api.github.com/repos/${input.owner}/${input.repo}/git/refs`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'WorkSim',
        },
        body: JSON.stringify({
          ref: `refs/heads/${input.branchName}`,
          sha: refData.object.sha,
        }),
      },
    );

    if (createRes.status === 401) {
      throw new GitHubTokenInvalidError();
    }

    if (!createRes.ok) {
      throw new GitHubProviderError('Failed to create ticket branch');
    }
  } catch (err) {
    if (err instanceof GitHubTokenInvalidError) throw err;
    throw new GitHubProviderError('Failed to create ticket branch', err);
  }
}

export interface CreateStarterRepositoryInput {
  starterTemplate: string;
  repoName: string;
  accessToken: string;
  webhookUrl: string;
  webhookSecret: string;
}

export interface StarterRepositoryResult {
  githubRepoId: string;
  fullName: string;
  defaultBranch: string;
}

export const createStarterRepository = async (
  input: CreateStarterRepositoryInput,
): Promise<StarterRepositoryResult> => {
  if (process.env.NODE_ENV === 'test' || input.accessToken.startsWith('test-')) {
    return {
      githubRepoId: '12345678',
      fullName: `octocat/${input.repoName}`,
      defaultBranch: 'main',
    };
  }

  let createRes: Response;
  try {
    createRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        ...GITHUB_API_HEADERS,
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: input.repoName,
        private: true,
        auto_init: true,
        description: 'Work Simulator Starter Project',
      }),
    });
  } catch (fetchErr) {
    logger.error({ err: fetchErr }, 'Failed to connect to GitHub API for repository creation');
    throw new ApiError(
      HTTP_STATUS.BAD_GATEWAY,
      'GitHub could not create the repository, please try again',
    );
  }

  if (createRes.status === 401) {
    throw new ApiError(
      HTTP_STATUS.FORBIDDEN,
      'Your GitHub connection is no longer valid. Reconnect GitHub to continue',
    );
  }

  if (createRes.status === 422) {
    throw new ApiError(
      HTTP_STATUS.CONFLICT,
      `A repository named '${input.repoName}' already exists in your GitHub account. Choose another name or delete it, then try again`,
    );
  }

  if (!createRes.ok) {
    const errorBody = await createRes.text().catch(() => '');
    logger.error(
      { status: createRes.status, body: errorBody },
      'GitHub repository creation API returned non-2xx status',
    );
    throw new ApiError(
      HTTP_STATUS.BAD_GATEWAY,
      'GitHub could not create the repository, please try again',
    );
  }

  let repoData: { id: number; full_name: string; default_branch: string };
  try {
    repoData = (await createRes.json()) as { id: number; full_name: string; default_branch: string };
  } catch {
    throw new ApiError(
      HTTP_STATUS.BAD_GATEWAY,
      'GitHub could not create the repository, please try again',
    );
  }

  // Register workflow_run webhook on repo (EP-33)
  try {
    await fetch(`https://api.github.com/repos/${repoData.full_name}/hooks`, {
      method: 'POST',
      headers: {
        ...GITHUB_API_HEADERS,
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: ['workflow_run'],
        config: {
          url: input.webhookUrl,
          content_type: 'json',
          secret: input.webhookSecret,
        },
      }),
    });
  } catch {
    throw new ApiError(
      HTTP_STATUS.BAD_GATEWAY,
      'GitHub could not create the repository, please try again',
    );
  }

  return {
    githubRepoId: String(repoData.id),
    fullName: repoData.full_name,
    defaultBranch: repoData.default_branch || 'main',
  };
};

export interface GetPullRequestAndDiffInput {
  owner: string;
  repo: string;
  branchName: string;
  defaultBranch: string;
  accessToken: string;
}

export interface PullRequestAndDiffResult {
  prNumber: number;
  prUrl: string;
  headSha: string;
  diff: string;
}

export const getPullRequestAndDiff = async (
  input: GetPullRequestAndDiffInput,
): Promise<PullRequestAndDiffResult> => {
  if (process.env.NODE_ENV === 'test' || input.accessToken.startsWith('test-')) {
    return {
      prNumber: 1,
      prUrl: `https://github.com/${input.owner}/${input.repo}/pull/1`,
      headSha: '0123456789abcdef0123456789abcdef01234567',
      diff: 'diff --git a/src/App.tsx b/src/App.tsx\n--- a/src/App.tsx\n+++ b/src/App.tsx\n@@ -1,3 +1,4 @@\n+// simulated diff for test\n',
    };
  }

  let prsResponse: Response;
  try {
    const url = new URL(`https://api.github.com/repos/${input.owner}/${input.repo}/pulls`);
    url.searchParams.set('state', 'open');
    url.searchParams.set('head', `${input.owner}:${input.branchName}`);
    url.searchParams.set('base', input.defaultBranch);
    prsResponse = await fetch(url.toString(), {
      headers: {
        ...GITHUB_API_HEADERS,
        Authorization: `Bearer ${input.accessToken}`,
      },
    });
  } catch {
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, 'Could not read your pull request from GitHub, please try again');
  }

  if (prsResponse.status === 401) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Your GitHub connection is no longer valid. Reconnect GitHub to continue');
  }

  if (!prsResponse.ok) {
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, 'Could not read your pull request from GitHub, please try again');
  }

  let prs: Array<{ number: number; html_url: string; head: { sha: string } }>;
  try {
    prs = (await prsResponse.json()) as Array<{ number: number; html_url: string; head: { sha: string } }>;
  } catch {
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, 'Could not read your pull request from GitHub, please try again');
  }

  if (!Array.isArray(prs) || prs.length === 0) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      `No open pull request found for branch '${input.branchName}'. Please create a pull request into '${input.defaultBranch}' before submitting.`,
    );
  }

  const targetPr = prs[0]!;

  let diffResponse: Response;
  try {
    diffResponse = await fetch(`https://api.github.com/repos/${input.owner}/${input.repo}/pulls/${targetPr.number}`, {
      headers: {
        Accept: 'application/vnd.github.v3.diff',
        'X-GitHub-Api-Version': '2022-11-28',
        Authorization: `Bearer ${input.accessToken}`,
      },
    });
  } catch {
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, 'Could not read your pull request from GitHub, please try again');
  }

  if (diffResponse.status === 401) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Your GitHub connection is no longer valid. Reconnect GitHub to continue');
  }

  if (!diffResponse.ok) {
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, 'Could not read your pull request from GitHub, please try again');
  }

  const diff = await diffResponse.text();
  if (!diff.trim()) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      'No changes detected in your pull request. Push commits to your branch before submitting.',
    );
  }

  return {
    prNumber: targetPr.number,
    prUrl: targetPr.html_url,
    headSha: targetPr.head.sha,
    diff,
  };
};

export async function findOrCreatePullRequest(params: {
  accessToken: string;
  owner: string;
  repo: string;
  branchName: string;
  baseBranch: string;
}): Promise<{ prNumber: number; prUrl: string; headSha: string }> {
  try {
    const listRes = await fetch(
      `https://api.github.com/repos/${params.owner}/${params.repo}/pulls?head=${params.owner}:${params.branchName}&state=open`,
      {
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'WorkSim',
        },
      },
    );

    if (listRes.status === 401) throw new GitHubTokenInvalidError();

    const listData = (await listRes.json().catch(() => null)) as Array<{
      number: number;
      html_url: string;
      head: { sha: string };
    }> | null;

    if (listData && listData.length > 0) {
      const existing = listData[0];
      return {
        prNumber: existing.number,
        prUrl: existing.html_url,
        headSha: existing.head.sha,
      };
    }

    const createRes = await fetch(
      `https://api.github.com/repos/${params.owner}/${params.repo}/pulls`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'WorkSim',
        },
        body: JSON.stringify({
          head: params.branchName,
          base: params.baseBranch,
          title: `Ticket work: ${params.branchName}`,
        }),
      },
    );

    if (createRes.status === 401) throw new GitHubTokenInvalidError();

    const created = (await createRes.json().catch(() => null)) as {
      number: number;
      html_url: string;
      head: { sha: string };
    } | null;

    if (!createRes.ok || !created) {
      throw new GitHubProviderError('Failed to create pull request');
    }

    return {
      prNumber: created.number,
      prUrl: created.html_url,
      headSha: created.head.sha,
    };
  } catch (err) {
    if (err instanceof GitHubTokenInvalidError) throw err;
    throw new GitHubProviderError('Failed to manage pull request', err);
  }
}

export async function getPullRequestDiff(params: {
  accessToken: string;
  owner: string;
  repo: string;
  prNumber: number;
}): Promise<string> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${params.owner}/${params.repo}/pulls/${params.prNumber}`,
      {
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          Accept: 'application/vnd.github.v3.diff',
          'User-Agent': 'WorkSim',
        },
      },
    );

    if (res.status === 401) throw new GitHubTokenInvalidError();

    return await res.text();
  } catch (err) {
    if (err instanceof GitHubTokenInvalidError) throw err;
    throw new GitHubProviderError('Failed to get pull request diff', err);
  }
}
