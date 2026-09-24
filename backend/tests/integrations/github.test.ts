import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRepos = { createUsingTemplate: vi.fn(), createWebhook: vi.fn() };
const mockGit = { getRef: vi.fn(), createRef: vi.fn() };
const mockPulls = { list: vi.fn(), create: vi.fn(), get: vi.fn() };

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    repos: mockRepos,
    git: mockGit,
    pulls: mockPulls,
  })),
}));

import {
  exchangeCodeForToken,
  createRepoFromTemplate,
  registerWorkflowWebhook,
  createBranch,
  findOrCreatePullRequest,
  getPullRequestDiff,
  GitHubTokenInvalidError,
  GitHubProviderError,
} from '../../src/integrations/github';

describe('github integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_OAUTH_CLIENT_ID = 'client-id';
    process.env.GITHUB_OAUTH_CLIENT_SECRET = 'client-secret';
  });

  describe('exchangeCodeForToken', () => {
    it('returns access token and scope on success', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'gho_abc123', scope: 'repo' }),
      }) as any;

      const result = await exchangeCodeForToken('some-code');
      expect(result).toEqual({ accessToken: 'gho_abc123', scope: 'repo' });
    });

    it('throws GitHubProviderError when GitHub returns an error body', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error: 'bad_verification_code' }),
      }) as any;

      await expect(exchangeCodeForToken('bad-code')).rejects.toThrow(GitHubProviderError);
    });

    it('throws GitHubProviderError on network failure, without leaking the code', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('network down'));
      try {
        await exchangeCodeForToken('super-secret-code');
        throw new Error('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(GitHubProviderError);
        expect((err as Error).message).not.toContain('super-secret-code');
      }
    });
  });

  describe('createRepoFromTemplate', () => {
    it('creates a repo and returns its identifying fields', async () => {
      mockRepos.createUsingTemplate.mockResolvedValue({
        data: { id: 42, full_name: 'user/work-simulator', default_branch: 'main' },
      });

      const result = await createRepoFromTemplate({
        accessToken: 'gho_abc',
        templateOwner: 'Lab-Lynx',
        templateRepo: 'node-express-starter',
        name: 'work-simulator',
      });

      expect(result).toEqual({
        repoId: '42',
        fullName: 'user/work-simulator',
        defaultBranch: 'main',
      });
    });

    it('throws GitHubTokenInvalidError on a 401', async () => {
      mockRepos.createUsingTemplate.mockRejectedValue({ status: 401 });
      await expect(
        createRepoFromTemplate({
          accessToken: 'bad',
          templateOwner: 'o',
          templateRepo: 'r',
          name: 'n',
        }),
      ).rejects.toThrow(GitHubTokenInvalidError);
    });

    it('normalizes any other failure to GitHubProviderError', async () => {
      mockRepos.createUsingTemplate.mockRejectedValue({
        status: 422,
        message: 'name already exists',
      });
      await expect(
        createRepoFromTemplate({
          accessToken: 'gho_abc',
          templateOwner: 'o',
          templateRepo: 'r',
          name: 'n',
        }),
      ).rejects.toThrow(GitHubProviderError);
    });
  });

  describe('registerWorkflowWebhook', () => {
    it('registers a workflow_run webhook', async () => {
      mockRepos.createWebhook.mockResolvedValue({ data: {} });

      await expect(
        registerWorkflowWebhook({
          accessToken: 'gho_abc',
          owner: 'user',
          repo: 'work-simulator',
          webhookUrl: 'https://api.example.com/webhooks/github',
          webhookSecret: 'shh',
        }),
      ).resolves.not.toThrow();

      expect(mockRepos.createWebhook).toHaveBeenCalledWith(
        expect.objectContaining({ events: ['workflow_run'] }),
      );
    });
  });

  describe('createBranch', () => {
    it('reads the base branch sha and creates the new branch from it', async () => {
      mockGit.getRef.mockResolvedValue({ data: { object: { sha: 'base-sha-123' } } });
      mockGit.createRef.mockResolvedValue({ data: {} });

      await createBranch({
        accessToken: 'gho_abc',
        owner: 'user',
        repo: 'work-simulator',
        branchName: 'ticket-1',
        baseBranch: 'main',
      });

      expect(mockGit.createRef).toHaveBeenCalledWith(
        expect.objectContaining({ ref: 'refs/heads/ticket-1', sha: 'base-sha-123' }),
      );
    });
  });

  describe('findOrCreatePullRequest', () => {
    it('reuses an existing open PR for the branch instead of creating a new one', async () => {
      mockPulls.list.mockResolvedValue({
        data: [
          { number: 7, html_url: 'https://github.com/user/repo/pull/7', head: { sha: 'sha-7' } },
        ],
      });

      const result = await findOrCreatePullRequest({
        accessToken: 'gho_abc',
        owner: 'user',
        repo: 'work-simulator',
        branchName: 'ticket-1',
        baseBranch: 'main',
      });

      expect(result).toEqual({
        prNumber: 7,
        prUrl: 'https://github.com/user/repo/pull/7',
        headSha: 'sha-7',
      });
      expect(mockPulls.create).not.toHaveBeenCalled();
    });

    it('creates a new PR when none exists', async () => {
      mockPulls.list.mockResolvedValue({ data: [] });
      mockPulls.create.mockResolvedValue({
        data: {
          number: 9,
          html_url: 'https://github.com/user/repo/pull/9',
          head: { sha: 'sha-9' },
        },
      });

      const result = await findOrCreatePullRequest({
        accessToken: 'gho_abc',
        owner: 'user',
        repo: 'work-simulator',
        branchName: 'ticket-2',
        baseBranch: 'main',
      });

      expect(result.prNumber).toBe(9);
      expect(mockPulls.create).toHaveBeenCalled();
    });
  });

  describe('getPullRequestDiff', () => {
    it('returns the raw diff text', async () => {
      mockPulls.get.mockResolvedValue({ data: '--- a/file.ts\n+++ b/file.ts\n' });

      const diff = await getPullRequestDiff({
        accessToken: 'gho_abc',
        owner: 'user',
        repo: 'work-simulator',
        prNumber: 9,
      });

      expect(diff).toContain('file.ts');
    });
  });

  describe('error normalization', () => {
    it('never includes the access token in a thrown error message', async () => {
      mockRepos.createUsingTemplate.mockRejectedValue({ status: 500, message: 'server error' });
      try {
        await createRepoFromTemplate({
          accessToken: 'gho_should_never_appear_in_errors',
          templateOwner: 'o',
          templateRepo: 'r',
          name: 'n',
        });
        throw new Error('expected throw');
      } catch (err) {
        expect((err as Error).message).not.toContain('gho_should_never_appear_in_errors');
      }
    });
  });
});
