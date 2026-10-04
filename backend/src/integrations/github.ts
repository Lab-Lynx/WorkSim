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
