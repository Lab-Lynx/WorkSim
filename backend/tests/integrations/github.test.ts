import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
vi.stubEnv('GITHUB_REQUESTED_SCOPE', 'write:repo_hook');

const { exchangeOAuthCode } = await import('../../src/integrations/github.js');

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
