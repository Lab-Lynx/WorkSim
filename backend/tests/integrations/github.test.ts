import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
vi.stubEnv('GITHUB_REQUESTED_SCOPE', 'write:repo_hook');

const { exchangeOAuthCode, createStarterRepository } = await import('../../src/integrations/github.js');

const response = (body: unknown, ok = true): Response =>
  ({
    ok,
    json: async () => body,
  }) as Response;

describe('GitHub OAuth integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exchanges the code, verifies exact scope, and reads the identity', async () => {
    fetchMock
      .mockResolvedValueOnce(response({ access_token: 'gho_secret', scope: 'write:repo_hook' }))
      .mockResolvedValueOnce(response({ id: 123, login: 'octocat' }));

    await expect(exchangeOAuthCode('code')).resolves.toEqual({
      accessToken: 'gho_secret',
      scope: 'write:repo_hook',
      githubUserId: '123',
      githubLogin: 'octocat',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://github.com/login/oauth/access_token',
      expect.objectContaining({
        body: expect.stringContaining('"code":"code"'),
        headers: expect.objectContaining({
          Accept: 'application/json',
          'User-Agent': 'WorkSim',
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.github.com/user',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer gho_secret' }) }),
    );
  });

  it('rejects broader or missing scopes', async () => {
    fetchMock.mockResolvedValueOnce(
      response({ access_token: 'gho_secret', scope: 'repo,write:repo_hook' }),
    );

    await expect(exchangeOAuthCode('code')).rejects.toMatchObject({
      statusCode: 502,
      message: 'GitHub returned an invalid permission scope',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('accepts normalized repo scope when repo,write:repo_hook is requested', async () => {
    vi.stubEnv('GITHUB_REQUESTED_SCOPE', 'repo,write:repo_hook');
    fetchMock
      .mockResolvedValueOnce(response({ access_token: 'gho_secret', scope: 'repo' }))
      .mockResolvedValueOnce(response({ id: 123, login: 'octocat' }));

    await expect(exchangeOAuthCode('code')).resolves.toEqual({
      accessToken: 'gho_secret',
      scope: 'repo',
      githubUserId: '123',
      githubLogin: 'octocat',
    });
    vi.stubEnv('GITHUB_REQUESTED_SCOPE', 'write:repo_hook');
  });

  it('accepts both repo and write:repo_hook when requested', async () => {
    vi.stubEnv('GITHUB_REQUESTED_SCOPE', 'repo,write:repo_hook');
    fetchMock
      .mockResolvedValueOnce(response({ access_token: 'gho_secret', scope: 'repo,write:repo_hook' }))
      .mockResolvedValueOnce(response({ id: 123, login: 'octocat' }));

    await expect(exchangeOAuthCode('code')).resolves.toEqual({
      accessToken: 'gho_secret',
      scope: 'repo,write:repo_hook',
      githubUserId: '123',
      githubLogin: 'octocat',
    });
    vi.stubEnv('GITHUB_REQUESTED_SCOPE', 'write:repo_hook');
  });

  it('rejects when missing repo when repo,write:repo_hook is requested', async () => {
    vi.stubEnv('GITHUB_REQUESTED_SCOPE', 'repo,write:repo_hook');
    fetchMock.mockResolvedValueOnce(
      response({ access_token: 'gho_secret', scope: 'write:repo_hook' }),
    );

    await expect(exchangeOAuthCode('code')).rejects.toMatchObject({
      statusCode: 502,
      message: 'GitHub returned an invalid permission scope',
    });
    vi.stubEnv('GITHUB_REQUESTED_SCOPE', 'write:repo_hook');
  });
});

describe('createStarterRepository', () => {
  const input = {
    repoName: 'work-simulator',
    accessToken: 'gho_secret',
    webhookUrl: 'https://api.example.com/api/v1/webhooks/github',
    webhookSecret: 'hook-secret',
  };
  const repo = { id: 99, full_name: 'octocat/work-simulator', default_branch: 'main' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'production');
  });

  it.each([
    ['react', 'Lab-Lynx/react_starter_template'],
    ['django', 'Lab-Lynx/django_starter_template'],
    ['node_express', 'Lab-Lynx/express-starter-template'],
  ])('generates the repo from the %s template', async (starterTemplate, templateRepo) => {
    fetchMock
      .mockResolvedValueOnce(response(repo))
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(response({}));

    await expect(createStarterRepository({ ...input, starterTemplate })).resolves.toEqual({
      githubRepoId: '99',
      fullName: 'octocat/work-simulator',
      defaultBranch: 'main',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `https://api.github.com/repos/${templateRepo}/generate`,
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"name":"work-simulator"'),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.github.com/repos/octocat/work-simulator/git/ref/heads/main',
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://api.github.com/repos/octocat/work-simulator/hooks',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('rejects an unknown template without calling GitHub', async () => {
    await expect(createStarterRepository({ ...input, starterTemplate: 'rails' })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still returns the repo when the webhook cannot be registered', async () => {
    fetchMock
      .mockResolvedValueOnce(response(repo))
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({}) } as Response);

    await expect(
      createStarterRepository({ ...input, starterTemplate: 'react' }),
    ).resolves.toMatchObject({ fullName: 'octocat/work-simulator' });
  });

  it('reports a name clash as a conflict', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({}) } as Response);

    await expect(
      createStarterRepository({ ...input, starterTemplate: 'react' }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
