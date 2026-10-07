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
  'User-Agent': 'WorkSim',
};

// The OAuth token endpoint only answers in JSON when Accept is exactly application/json;
// any other value returns a form-encoded body that cannot be parsed as JSON.
const GITHUB_OAUTH_TOKEN_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'WorkSim',
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

export class GitHubOAuthRejectedError extends ApiError {
  constructor(readonly githubError: string | undefined) {
    super(HTTP_STATUS.BAD_GATEWAY, 'Could not connect to GitHub');
    this.name = 'GitHubOAuthRejectedError';
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
      headers: GITHUB_OAUTH_TOKEN_HEADERS,
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
    logger.warn({ reason: tokenPayload.error }, 'GitHub OAuth token exchange rejected');
    throw new GitHubOAuthRejectedError(tokenPayload.error);
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

const STARTER_TEMPLATE_REPOS: Record<string, string> = {
  react: 'Lab-Lynx/react_starter_template',
  django: 'Lab-Lynx/django_starter_template',
  node_express: 'Lab-Lynx/express-starter-template',
};

// A repo generated from a template can answer before its files are committed; ticket branches
// are cut from the default branch right after, so wait until that branch resolves.
const waitForBranch = async (
  fullName: string,
  branch: string,
  accessToken: string,
  attempts = 10,
): Promise<void> => {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(`https://api.github.com/repos/${fullName}/git/ref/heads/${branch}`, {
        headers: { ...GITHUB_API_HEADERS, Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  logger.warn({ repo: fullName, branch }, 'Starter repo branch not readable yet after generation');
};

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

  const template = STARTER_TEMPLATE_REPOS[input.starterTemplate];
  if (!template) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, `Unknown starter template '${input.starterTemplate}'`);
  }

  let createRes: Response;
  try {
    createRes = await fetch(`https://api.github.com/repos/${template}/generate`, {
      method: 'POST',
      headers: {
        ...GITHUB_API_HEADERS,
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: input.repoName,
        private: true,
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

  const defaultBranch = repoData.default_branch || 'main';
  await waitForBranch(repoData.full_name, defaultBranch, input.accessToken);

  // Register workflow_run webhook on repo (EP-33). A failure here is not fatal: submissions
  // also read the commit's CI state straight from GitHub.
  try {
    const hookRes = await fetch(`https://api.github.com/repos/${repoData.full_name}/hooks`, {
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
    if (!hookRes.ok) {
      logger.warn(
        { status: hookRes.status, repo: repoData.full_name },
        'Could not register the workflow_run webhook on the starter repo',
      );
    }
  } catch (hookErr) {
    logger.warn({ err: hookErr, repo: repoData.full_name }, 'Could not register the workflow_run webhook');
  }

  return {
    githubRepoId: String(repoData.id),
    fullName: repoData.full_name,
    defaultBranch,
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

export type CommitCiState =
  | { state: 'none' }
  | { state: 'pending' }
  | { state: 'passed'; runUrl: string | null }
  | { state: 'failed'; runUrl: string | null; conclusion: string };

export interface GetCommitCiStateInput {
  owner: string;
  repo: string;
  headSha: string;
  accessToken: string;
}

/**
 * Reads GitHub Actions runs for a commit. Covers CI that finished before the
 * submission existed, because the workflow_run webhook is only delivered once.
 */
export const getCommitCiState = async (input: GetCommitCiStateInput): Promise<CommitCiState> => {
  if (process.env.NODE_ENV === 'test' || input.accessToken.startsWith('test-')) {
    return { state: 'pending' };
  }

  const url = new URL(`https://api.github.com/repos/${input.owner}/${input.repo}/actions/runs`);
  url.searchParams.set('head_sha', input.headSha);
  url.searchParams.set('per_page', '20');

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { ...GITHUB_API_HEADERS, Authorization: `Bearer ${input.accessToken}` },
    });
  } catch {
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, 'Could not read CI results from GitHub');
  }

  if (response.status === 401) {
    throw new ApiError(
      HTTP_STATUS.FORBIDDEN,
      'Your GitHub connection is no longer valid. Reconnect GitHub to continue',
    );
  }
  if (!response.ok) {
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, 'Could not read CI results from GitHub');
  }

  const payload = (await response.json().catch(() => null)) as {
    workflow_runs?: Array<{ status: string; conclusion: string | null; html_url: string }>;
  } | null;
  const runs = payload?.workflow_runs ?? [];

  if (runs.length === 0) return { state: 'none' };
  if (runs.some((run) => run.status !== 'completed')) return { state: 'pending' };

  const failedRun = runs.find((run) => run.conclusion !== 'success');
  if (failedRun) {
    return {
      state: 'failed',
      runUrl: failedRun.html_url ?? null,
      conclusion: failedRun.conclusion ?? 'unknown',
    };
  }
  return { state: 'passed', runUrl: runs[0]?.html_url ?? null };
};
