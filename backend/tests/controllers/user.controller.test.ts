import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTP_STATUS } from '../../src/constants/index.js';

const getCurrentUser = vi.fn();
const updateDisplayName = vi.fn();

vi.mock('../../src/services/user.service.js', () => ({
  getCurrentUser,
  updateDisplayName,
}));

const { getMe, updateMe } = await import('../../src/controllers/user.controller.js');

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

describe('user.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getMe returns 200 Current user with only public fields', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    getCurrentUser.mockResolvedValue({
      id: 'user-1',
      name: 'Ada',
      email: 'ada@example.com',
      role: 'user',
      emailVerifiedAt: null,
      createdAt,
      passwordHash: 'should-not-leak',
    });

    const req = { user: { id: 'user-1', role: 'user' } };
    const res = mockRes();
    const next = vi.fn();

    await getMe(req as never, res as never, next);

    expect(getCurrentUser).toHaveBeenCalledWith('user-1');
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HTTP_STATUS.OK,
        success: true,
        message: 'Current user',
        data: {
          user: {
            id: 'user-1',
            name: 'Ada',
            email: 'ada@example.com',
            role: 'user',
            emailVerifiedAt: null,
            createdAt: createdAt.toISOString(),
          },
        },
      }),
    );
    const body = res.json.mock.calls[0][0];
    expect(body.data.user).not.toHaveProperty('passwordHash');
    expect(Object.keys(body.data.user).sort()).toEqual(
      ['createdAt', 'email', 'emailVerifiedAt', 'id', 'name', 'role'].sort(),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('updateMe calls updateDisplayName and returns Profile updated', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    updateDisplayName.mockResolvedValue({
      id: 'user-1',
      name: 'New Name',
      email: 'ada@example.com',
      role: 'user',
      emailVerifiedAt: null,
      createdAt,
    });

    const req = {
      user: { id: 'user-1', role: 'user' },
      body: { name: 'New Name', email: 'evil@example.com', role: 'admin' },
    };
    const res = mockRes();
    const next = vi.fn();

    await updateMe(req as never, res as never, next);

    expect(updateDisplayName).toHaveBeenCalledWith('user-1', 'New Name');
    expect(updateDisplayName).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Profile updated',
        data: {
          user: expect.objectContaining({ name: 'New Name' }),
        },
      }),
    );
  });
});
