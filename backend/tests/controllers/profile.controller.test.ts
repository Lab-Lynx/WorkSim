import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTP_STATUS } from '../../src/constants/index.js';
import ApiError from '../../src/utils/ApiError.js';

const getExperienceProfile = vi.fn();

vi.mock('../../src/services/profile.service.js', () => ({
  getExperienceProfile,
}));

const { getProfile } = await import('../../src/controllers/profile.controller.js');

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

const sampleItems = [
  {
    ticketId: 't-1',
    title: 'Add a button',
    category: 'frontend',
    difficulty: 'beginner',
    completedAt: '2026-03-02T00:00:00.000Z',
    evaluation: {
      feedback: 'Good work.',
      scores: {
        requirementsMet: 80,
        correctnessTests: 70,
        codeQuality: 60,
        problemSolving: 90,
        total: 74.5,
      },
      createdAt: '2026-03-02T12:00:00.000Z',
    },
  },
  {
    ticketId: 't-2',
    title: 'Fix a bug',
    category: 'backend',
    difficulty: 'intermediate',
    completedAt: '2026-02-01T00:00:00.000Z',
    evaluation: {
      feedback: 'Nice fix.',
      scores: {
        requirementsMet: 90,
        correctnessTests: 85,
        codeQuality: 80,
        problemSolving: 75,
        total: 84.25,
      },
      createdAt: '2026-02-01T12:00:00.000Z',
    },
  },
];

describe('profile.controller (doc 9 §9.3.2 / EP-34)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getProfile returns 200 Profile with data.items from the service', async () => {
    getExperienceProfile.mockResolvedValue(sampleItems);

    const req = { user: { id: 'user-1', role: 'user' } };
    const res = mockRes();
    const next = vi.fn();

    await getProfile(req as never, res as never, next);

    expect(getExperienceProfile).toHaveBeenCalledWith('user-1');
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
    const body = res.json.mock.calls[0][0];
    expect(body).toEqual(
      expect.objectContaining({
        statusCode: HTTP_STATUS.OK,
        success: true,
        message: 'Profile',
        data: { items: sampleItems },
      }),
    );
    expect(body.data.items).toHaveLength(2);
    for (const item of body.data.items) {
      expect(Object.keys(item).sort()).toEqual(
        ['category', 'completedAt', 'difficulty', 'evaluation', 'ticketId', 'title'].sort(),
      );
    }
    expect(next).not.toHaveBeenCalled();
  });

  it('getProfile returns items: [] when the service returns an empty list', async () => {
    getExperienceProfile.mockResolvedValue([]);

    const req = { user: { id: 'user-1', role: 'user' } };
    const res = mockRes();
    const next = vi.fn();

    await getProfile(req as never, res as never, next);

    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Profile',
        data: { items: [] },
      }),
    );
  });

  it('getProfile throws 401 when not authenticated', async () => {
    const req = { user: undefined };
    const res = mockRes();
    const next = vi.fn();

    await getProfile(req as never, res as never, next);

    expect(getExperienceProfile).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next.mock.calls[0][0]).toMatchObject({
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      message: 'Not authenticated',
    });
  });
});
