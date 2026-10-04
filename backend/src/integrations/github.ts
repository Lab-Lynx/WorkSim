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

export async function exchangeCodeForToken(
  code: string,
): Promise<{ accessToken: string; scope: string }> {
  const clientId = process.env.GITHUB_CLIENT_ID || process.env.GITHUB_OAUTH_CLIENT_ID || '';
  const clientSecret =
    process.env.GITHUB_CLIENT_SECRET || process.env.GITHUB_OAUTH_CLIENT_SECRET || '';

  if (!clientId || !clientSecret) {
    throw new Error('GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET is not set');
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
  // If no accessToken or in mock mode / placeholder, complete successfully
  if (!input.accessToken) return;

  try {
    // 1. Get base branch ref sha
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

    // 2. Create new branch ref
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
