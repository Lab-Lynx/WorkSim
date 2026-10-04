import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/experience.service', () => ({
  createExperience: vi.fn(),
  listExperiences: vi.fn(),
  getExperienceById: vi.fn(),
  hideExperience: vi.fn(),
}));

vi.mock('../../src/serializers/experience.serializer', () => ({
  serializeExperience: vi.fn((e: any) => ({
    id: e.id,
    authorName: e.authorName,
    content: e.content,
    createdAt: e.createdAt,
  })),
}));

import * as experienceService from '../../src/services/experience.service';
import { serializeExperience } from '../../src/serializers/experience.serializer';
import {
  listExperiences,
  getExperience,
  createExperience,
  hideExperience,
} from '../../src/controllers/experience.controller';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => vi.clearAllMocks());

describe('listExperiences', () => {
  it('returns the serialized items plus nextCursor', async () => {
    (experienceService.listExperiences as any).mockResolvedValue({
      items: [{ id: 'e1', authorName: null, content: 'advice', createdAt: new Date() }],
      nextCursor: 'e1',
    });
    const req: any = { query: { limit: 20 } };
    const res = mockRes();

    await listExperiences(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { items: [expect.objectContaining({ id: 'e1' })], nextCursor: 'e1' },
      }),
    );
  });

  it('forwards errors to next()', async () => {
    const err = new Error('db down');
    (experienceService.listExperiences as any).mockRejectedValue(err);
    const next = vi.fn();
    await listExperiences({ query: {} } as any, mockRes(), next);
    expect(next).toHaveBeenCalledWith(err);
  });
});

describe('getExperience', () => {
  it('returns the serialized experience when found', async () => {
    (experienceService.getExperienceById as any).mockResolvedValue({
      id: 'e1',
      content: 'advice',
      authorName: null,
      createdAt: new Date(),
    });
    const res = mockRes();
    await getExperience({ params: { id: 'e1' } } as any, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(serializeExperience).toHaveBeenCalled();
  });

  it('returns 404 (not next()) when the experience is hidden or missing', async () => {
    (experienceService.getExperienceById as any).mockResolvedValue(null);
    const res = mockRes();
    const next = vi.fn();
    await getExperience({ params: { id: 'hidden-or-missing' } } as any, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('createExperience', () => {
  it('returns 201 with the serialized created experience', async () => {
    (experienceService.createExperience as any).mockResolvedValue({
      id: 'e1',
      authorName: 'Dawit',
      content: 'advice here',
      createdAt: new Date(),
    });
    const req: any = { body: { content: 'advice here', authorName: 'Dawit' } };
    const res = mockRes();

    await createExperience(req, res, vi.fn());

    expect(experienceService.createExperience).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('still returns 201 for a honeypot-tripped submission (the controller does not know or care)', async () => {
    (experienceService.createExperience as any).mockResolvedValue({
      id: 'fake-id',
      authorName: 'Bot',
      content: 'bot advice',
      createdAt: new Date(),
    });
    const req: any = { body: { content: 'bot advice', authorName: 'Bot', hp: 'caught' } };
    const res = mockRes();

    await createExperience(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(201); // identical to a real success, by design
  });
});

describe('hideExperience', () => {
  it('returns 200 with null data on success', async () => {
    (experienceService.hideExperience as any).mockResolvedValue(undefined);
    const res = mockRes();
    await hideExperience({ params: { id: 'e1' } } as any, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: null }));
  });

  it('forwards a 404 from the service to next()', async () => {
    const err = { statusCode: 404 };
    (experienceService.hideExperience as any).mockRejectedValue(err);
    const next = vi.fn();
    await hideExperience({ params: { id: 'nope' } } as any, mockRes(), next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
