import { Octokit } from '@octokit/rest';

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

function getClient(accessToken: string): Octokit {
  return new Octokit({ auth: accessToken });
}

// Every real GitHub call funnels through here, so "detect 401, normalize
// everything else" only has to be written once instead of in six places.
async function callGitHub<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (err?.status === 401) {
      throw new GitHubTokenInvalidError();
    }
    // Deliberately generic message — never include `err.message` verbatim
    // here, since some GitHub error bodies can echo request details back.
    throw new GitHubProviderError('GitHub API call failed', err);
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export async function exchangeCodeForToken(
  code: string,
): Promise<{ accessToken: string; scope: string }> {
  const clientId = requireEnv('GITHUB_OAUTH_CLIENT_ID');
  const clientSecret = requireEnv('GITHUB_OAUTH_CLIENT_SECRET');

  let response: Response;
  try {
    response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
  } catch (err) {
    throw new GitHubProviderError('Failed to reach GitHub for token exchange', err);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok || !data || data.error || !data.access_token) {
    throw new GitHubProviderError('GitHub token exchange failed');
  }

  return { accessToken: data.access_token, scope: data.scope ?? '' };
}

export async function createRepoFromTemplate(params: {
  accessToken: string;
  templateOwner: string;
  templateRepo: string;
  name: string;
}): Promise<{ repoId: string; fullName: string; defaultBranch: string }> {
  const client = getClient(params.accessToken);
  const { data } = await callGitHub(() =>
    client.repos.createUsingTemplate({
      template_owner: params.templateOwner,
      template_repo: params.templateRepo,
      name: params.name,
      private: false,
    }),
  );
  return { repoId: String(data.id), fullName: data.full_name, defaultBranch: data.default_branch };
}

export async function registerWorkflowWebhook(params: {
  accessToken: string;
  owner: string;
  repo: string;
  webhookUrl: string;
  webhookSecret: string;
}): Promise<void> {
  const client = getClient(params.accessToken);
  await callGitHub(() =>
    client.repos.createWebhook({
      owner: params.owner,
      repo: params.repo,
      config: { url: params.webhookUrl, content_type: 'json', secret: params.webhookSecret },
      events: ['workflow_run'],
    }),
  );
}

export async function createBranch(params: {
  accessToken: string;
  owner: string;
  repo: string;
  branchName: string;
  baseBranch: string;
}): Promise<void> {
  const client = getClient(params.accessToken);

  const { data: baseRef } = await callGitHub(() =>
    client.git.getRef({
      owner: params.owner,
      repo: params.repo,
      ref: `heads/${params.baseBranch}`,
    }),
  );

  await callGitHub(() =>
    client.git.createRef({
      owner: params.owner,
      repo: params.repo,
      ref: `refs/heads/${params.branchName}`,
      sha: baseRef.object.sha,
    }),
  );
}

export async function findOrCreatePullRequest(params: {
  accessToken: string;
  owner: string;
  repo: string;
  branchName: string;
  baseBranch: string;
}): Promise<{ prNumber: number; prUrl: string; headSha: string }> {
  const client = getClient(params.accessToken);

  const { data: existing } = await callGitHub(() =>
    client.pulls.list({
      owner: params.owner,
      repo: params.repo,
      head: `${params.owner}:${params.branchName}`,
      state: 'open',
    }),
  );

  let pr = existing[0];

  if (!pr) {
    const { data: created } = await callGitHub(() =>
      client.pulls.create({
        owner: params.owner,
        repo: params.repo,
        head: params.branchName,
        base: params.baseBranch,
        title: `Ticket work: ${params.branchName}`,
      }),
    );
    pr = created;
  }

  return { prNumber: pr.number, prUrl: pr.html_url, headSha: pr.head.sha };
}

export async function getPullRequestDiff(params: {
  accessToken: string;
  owner: string;
  repo: string;
  prNumber: number;
}): Promise<string> {
  const client = getClient(params.accessToken);
  const { data } = await callGitHub(() =>
    client.pulls.get({
      owner: params.owner,
      repo: params.repo,
      pull_number: params.prNumber,
      mediaType: { format: 'diff' },
    }),
  );
  return data as unknown as string;
}

// Add this alongside your existing exports
export async function getAuthenticatedUser(
  accessToken: string
): Promise<{ id: number; login: string }> {
  const client = getClient(accessToken);
  const { data } = await callGitHub(() => client.users.getAuthenticated());
  return { id: data.id, login: data.login };
}