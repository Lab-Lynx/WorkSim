import { describe, expect, it, vi } from 'vitest';

const completeGitHubAuthorization = vi.fn();
const createGitHubAuthorization = vi.fn();
vi.mock('../../src/services/github.service.js', () => ({
  createGitHubAuthorization,
  completeGitHubAuthorization,
}));

const { callback, connect } = await import('../../src/controllers/github.controller.js');

describe('github.controller', () => {
  it('returns an authorization URL for the authenticated user', async () => {
    createGitHubAuthorization.mockResolvedValue('https://github.com/login/oauth/authorize?state=x');
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await connect({ user: { id: 'user-1' } } as never, response as never, vi.fn());

    expect(createGitHubAuthorization).toHaveBeenCalledWith('user-1');
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { authorizeUrl: expect.stringContaining('github.com') } }),
    );
  });

  it('redirects callback results without exposing provider errors', async () => {
    completeGitHubAuthorization.mockResolvedValue(
      'http://localhost:5173/github?github=error&reason=state_invalid',
    );
    const response = { redirect: vi.fn() };

    await callback(
      { query: { state: 'state', code: 'code' } } as never,
      response as never,
      vi.fn(),
    );

    expect(completeGitHubAuthorization).toHaveBeenCalledWith('state', 'code');
    expect(response.redirect).toHaveBeenCalledWith(
      'http://localhost:5173/github?github=error&reason=state_invalid',
    );
  });
});
