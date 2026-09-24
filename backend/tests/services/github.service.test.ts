import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    gitHubConnection: { findUnique: vi.fn(), delete: vi.fn(), upsert: vi.fn() },
    starterRepo: { findUnique: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('../../src/services/subscription.service', () => ({
  hasPaidAccess: vi.fn(),
}));

vi.mock('../../src/lib/encryption/github-token', () => ({
  encryptGitHubToken: vi.fn((t: string) => `encrypted:${t}`),
  decryptGitHubToken: vi.fn((t: string) => t.replace('encrypted:', '')),
}));

vi.mock('../../src/lib/github/oauth-state', () => ({
  createOAuthState: vi.fn(() => 'fake-state'),
  verifyOAuthState: vi.fn(),
  OAuthStateError: class OAuthStateError extends Error {},
}));

vi.mock('../../src/integrations/github', () => ({
  exchangeCodeForToken: vi.fn(),
  getAuthenticatedUser: vi.fn(),
  createRepoFromTemplate: vi.fn(),
  registerWorkflowWebhook: vi.fn(),
  createBranch: vi.fn(),
  findOrCreatePullRequest: vi.fn(),
  getPullRequestDiff: vi.fn(),
  GitHubTokenInvalidError: class GitHubTokenInvalidError extends Error {},
  GitHubProviderError: class GitHubProviderError extends Error {
    constructor(
      message: string,
      readonly cause?: unknown,
    ) {
      super(message);
    }
  },
}));

import { prisma } from '../../src/lib/prisma';
import { hasPaidAccess } from '../../src/services/subscription.service';
import { verifyOAuthState, OAuthStateError } from '../../src/lib/github/oauth-state';
import * as githubIntegration from '../../src/integrations/github';
import {
  createGitHubAuthorizeUrl,
  handleGitHubCallback,
  getGitHubConnection,
  disconnectGitHub,
  createStarterRepo,
  createTicketBranch,
  getBranchSubmissionState,
  GitHubCallbackError,
} from '../../src/services/github.service';

const { GitHubTokenInvalidError, GitHubProviderError } = githubIntegration as any;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_OAUTH_CLIENT_ID = 'client-id';
  process.env.GITHUB_WEBHOOK_URL = 'https://api.example.com/webhooks/github';
  process.env.GITHUB_WEBHOOK_SECRET = 'whsecret';
});

describe('createGitHubAuthorizeUrl', () => {
  it('throws 402 when the user has no paid access', async () => {
    (hasPaidAccess as any).mockResolvedValue(false);
    await expect(createGitHubAuthorizeUrl('user-1')).rejects.toMatchObject({ statusCode: 402 });
  });

  it('builds a URL with the requested scope and state, and no access token', async () => {
    (hasPaidAccess as any).mockResolvedValue(true);
    const url = await createGitHubAuthorizeUrl('user-1');
    expect(url).toContain('scope=');
    expect(url).toContain('write%3Arepo_hook'); // write:repo_hook, URL-encoded
    expect(url).toContain('state=fake-state');
    expect(url).not.toMatch(/access_token|gho_/);
  });
});

describe('handleGitHubCallback', () => {
  it('throws state_invalid when the state fails verification', async () => {
    (verifyOAuthState as any).mockImplementation(() => {
      throw new OAuthStateError('bad');
    });
    await expect(handleGitHubCallback('user-1', 'code', 'bad-state')).rejects.toMatchObject({
      category: 'state_invalid',
    });
  });

  it('throws exchange_failed when the code exchange fails', async () => {
    (githubIntegration.exchangeCodeForToken as any).mockRejectedValue(new Error('boom'));
    await expect(handleGitHubCallback('user-1', 'code', 'state')).rejects.toMatchObject({
      category: 'exchange_failed',
    });
  });

  it('throws scope_invalid when granted scope exceeds what was requested', async () => {
    (githubIntegration.exchangeCodeForToken as any).mockResolvedValue({
      accessToken: 'gho_abc',
      scope: 'public_repo,write:repo_hook,admin:org', // admin:org was never requested
    });
    await expect(handleGitHubCallback('user-1', 'code', 'state')).rejects.toMatchObject({
      category: 'scope_invalid',
    });
  });

  it('stores the encrypted token and identity on success', async () => {
    (githubIntegration.exchangeCodeForToken as any).mockResolvedValue({
      accessToken: 'gho_abc',
      scope: 'public_repo,write:repo_hook',
    });
    (githubIntegration.getAuthenticatedUser as any).mockResolvedValue({
      id: 999,
      login: 'octocat',
    });

    await handleGitHubCallback('user-1', 'code', 'state');

    expect(prisma.gitHubConnection.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          accessTokenEncrypted: 'encrypted:gho_abc',
          githubLogin: 'octocat',
          githubUserId: '999',
        }),
      }),
    );
  });
});

describe('getGitHubConnection', () => {
  it('never includes accessTokenEncrypted in the response', async () => {
    (prisma.gitHubConnection.findUnique as any).mockResolvedValue({
      githubLogin: 'octocat',
      accessTokenEncrypted: 'encrypted:secret',
    });
    (prisma.starterRepo.findUnique as any).mockResolvedValue(null);

    const result = await getGitHubConnection('user-1');
    expect(result).not.toHaveProperty('accessTokenEncrypted');
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('repo stays visible even with no connection (post-disconnect)', async () => {
    (prisma.gitHubConnection.findUnique as any).mockResolvedValue(null);
    (prisma.starterRepo.findUnique as any).mockResolvedValue({
      fullName: 'user/work-simulator',
      starterTemplate: 'react',
      defaultBranch: 'main',
    });

    const result = await getGitHubConnection('user-1');
    expect(result.connected).toBe(false);
    expect(result.repo).toEqual({
      fullName: 'user/work-simulator',
      starterTemplate: 'react',
      defaultBranch: 'main',
    });
  });
});

describe('disconnectGitHub', () => {
  it('throws 404 if not connected', async () => {
    (prisma.gitHubConnection.findUnique as any).mockResolvedValue(null);
    await expect(disconnectGitHub('user-1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('deletes only the connection row, nothing else', async () => {
    (prisma.gitHubConnection.findUnique as any).mockResolvedValue({ userId: 'user-1' });
    await disconnectGitHub('user-1');
    expect(prisma.gitHubConnection.delete).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(prisma.starterRepo.create).not.toHaveBeenCalled();
  });
});

describe('createStarterRepo', () => {
  beforeEach(() => {
    (hasPaidAccess as any).mockResolvedValue(true);
    (prisma.gitHubConnection.findUnique as any).mockResolvedValue({
      userId: 'user-1',
      accessTokenEncrypted: 'encrypted:gho_abc',
    });
    (prisma.starterRepo.findUnique as any).mockResolvedValue(null);
  });

  it('rejects an unsupported template with 400', async () => {
    await expect(createStarterRepo('user-1', 'ruby' as any)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('requires paid access', async () => {
    (hasPaidAccess as any).mockResolvedValue(false);
    await expect(createStarterRepo('user-1', 'react')).rejects.toMatchObject({ statusCode: 402 });
  });

  it('requires a GitHub connection', async () => {
    (prisma.gitHubConnection.findUnique as any).mockResolvedValue(null);
    await expect(createStarterRepo('user-1', 'react')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects if the user already has a repo', async () => {
    (prisma.starterRepo.findUnique as any).mockResolvedValue({ id: 'existing' });
    await expect(createStarterRepo('user-1', 'react')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('does not report success if webhook registration fails, and does not save the repo', async () => {
    (githubIntegration.createRepoFromTemplate as any).mockResolvedValue({
      repoId: '1',
      fullName: 'user/work-simulator',
      defaultBranch: 'main',
    });
    (githubIntegration.registerWorkflowWebhook as any).mockRejectedValue(new Error('webhook boom'));

    await expect(createStarterRepo('user-1', 'react')).rejects.toMatchObject({ statusCode: 502 });
    expect(prisma.starterRepo.create).not.toHaveBeenCalled();
  });

  it('returns 409 with no auto-suffix on a name collision', async () => {
    (githubIntegration.createRepoFromTemplate as any).mockRejectedValue(
      new GitHubProviderError('failed', { status: 422 }),
    );
    await expect(createStarterRepo('user-1', 'react', 'taken-name')).rejects.toMatchObject({
      statusCode: 409,
    });
    // the message should reference the exact requested name, not a modified one
    await createStarterRepo('user-1', 'react', 'taken-name').catch((err) => {
      expect(err.message).toContain('taken-name');
    });
  });

  it('deletes the connection and returns 403 on a revoked token', async () => {
    (githubIntegration.createRepoFromTemplate as any).mockRejectedValue(
      new GitHubTokenInvalidError(),
    );
    await expect(createStarterRepo('user-1', 'react')).rejects.toMatchObject({ statusCode: 403 });
    expect(prisma.gitHubConnection.delete).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });

  it('creates the repo, registers the webhook, and saves StarterRepo on success', async () => {
    (githubIntegration.createRepoFromTemplate as any).mockResolvedValue({
      repoId: '1',
      fullName: 'user/work-simulator',
      defaultBranch: 'main',
    });
    (githubIntegration.registerWorkflowWebhook as any).mockResolvedValue(undefined);
    (prisma.starterRepo.create as any).mockResolvedValue({ id: 'new-repo' });

    await createStarterRepo('user-1', 'react');

    expect(githubIntegration.registerWorkflowWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ webhookUrl: 'https://api.example.com/webhooks/github' }),
    );
    expect(prisma.starterRepo.create).toHaveBeenCalled();
  });
});

describe('createTicketBranch', () => {
  it('requires GitHub connection (403)', async () => {
    (prisma.gitHubConnection.findUnique as any).mockResolvedValue(null);
    await expect(createTicketBranch('user-1', 'ticket-1', 'main')).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('requires a starter repo (409)', async () => {
    (prisma.gitHubConnection.findUnique as any).mockResolvedValue({
      accessTokenEncrypted: 'encrypted:t',
    });
    (prisma.starterRepo.findUnique as any).mockResolvedValue(null);
    await expect(createTicketBranch('user-1', 'ticket-1', 'main')).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('creates the branch on success', async () => {
    (prisma.gitHubConnection.findUnique as any).mockResolvedValue({
      accessTokenEncrypted: 'encrypted:t',
    });
    (prisma.starterRepo.findUnique as any).mockResolvedValue({
      fullName: 'user/repo',
      defaultBranch: 'main',
    });
    (githubIntegration.createBranch as any).mockResolvedValue(undefined);

    await createTicketBranch('user-1', 'ticket-1', 'main');
    expect(githubIntegration.createBranch).toHaveBeenCalled();
  });

  it('maps a provider failure to 502', async () => {
    (prisma.gitHubConnection.findUnique as any).mockResolvedValue({
      accessTokenEncrypted: 'encrypted:t',
    });
    (prisma.starterRepo.findUnique as any).mockResolvedValue({
      fullName: 'user/repo',
      defaultBranch: 'main',
    });
    (githubIntegration.createBranch as any).mockRejectedValue(new GitHubProviderError('boom'));

    await expect(createTicketBranch('user-1', 'ticket-1', 'main')).rejects.toMatchObject({
      statusCode: 502,
    });
  });
});

describe('getBranchSubmissionState', () => {
  beforeEach(() => {
    (prisma.gitHubConnection.findUnique as any).mockResolvedValue({
      accessTokenEncrypted: 'encrypted:t',
    });
    (prisma.starterRepo.findUnique as any).mockResolvedValue({
      fullName: 'user/repo',
      defaultBranch: 'main',
    });
  });

  it('returns 400 when there are no commits beyond the default branch', async () => {
    (githubIntegration.findOrCreatePullRequest as any).mockResolvedValue({
      prNumber: 1,
      prUrl: 'url',
      headSha: 'sha',
    });
    (githubIntegration.getPullRequestDiff as any).mockResolvedValue('');

    await expect(getBranchSubmissionState('user-1', 'ticket-1')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('returns PR number, URL, head SHA, and diff on success', async () => {
    (githubIntegration.findOrCreatePullRequest as any).mockResolvedValue({
      prNumber: 5,
      prUrl: 'https://github.com/user/repo/pull/5',
      headSha: 'sha123',
    });
    (githubIntegration.getPullRequestDiff as any).mockResolvedValue('--- a/x\n+++ b/x\n');

    const result = await getBranchSubmissionState('user-1', 'ticket-1');
    expect(result).toEqual({
      prNumber: 5,
      prUrl: 'https://github.com/user/repo/pull/5',
      headSha: 'sha123',
      diff: '--- a/x\n+++ b/x\n',
    });
  });

  it('reuses the same PR on a second call (attempt 2 behavior)', async () => {
    (githubIntegration.findOrCreatePullRequest as any).mockResolvedValue({
      prNumber: 5,
      prUrl: 'url',
      headSha: 'sha-v2',
    });
    (githubIntegration.getPullRequestDiff as any).mockResolvedValue('diff v2');

    await getBranchSubmissionState('user-1', 'ticket-1');
    await getBranchSubmissionState('user-1', 'ticket-1');

    const calls = (githubIntegration.findOrCreatePullRequest as any).mock.calls;
    expect(calls[0][0].branchName).toBe(calls[1][0].branchName);
  });
});
