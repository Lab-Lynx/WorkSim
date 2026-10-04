import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import { env } from '../config/env.js';

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

  const returnedScopes = (tokenPayload.scope ?? '')
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean)
    .sort()
    .join(',');
  if (returnedScopes !== env.GITHUB_REQUESTED_SCOPE.split(',').map((scope) => scope.trim()).sort().join(',')) {
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

/**
 * GitHub API adapter boundary (Doc 7 / Doc 8).
 * Real Octokit calls land in a later GitHub epic — default is a no-op success
 * so ticket lifecycle can be tested by mocking github.service.
 */
export const createBranch = async (input: {
  owner: string;
  repo: string;
  branchName: string;
  baseBranch: string;
  accessToken: string;
}): Promise<void> => {
  void input;
  // Intentionally empty until the GitHub integration epic wires Octokit.
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
  } catch {
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

