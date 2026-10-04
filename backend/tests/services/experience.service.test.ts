import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    experience: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '../../src/lib/prisma';
import {
  createExperience,
  listExperiences,
  getExperienceById,
  hideExperience,
} from '../../src/services/experience.service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createExperience', () => {
  it('creates a real row when hp is absent', async () => {
    (prisma.experience.create as any).mockResolvedValue({
      id: 'exp-1',
      authorName: 'Dawit',
      content: 'Real advice here.',
      hiddenAt: null,
      createdAt: new Date(),
    });

    const result = await createExperience({
      content: 'Real advice here.',
      authorName: 'Dawit',
    } as any);

    expect(prisma.experience.create).toHaveBeenCalledWith({
      data: { content: 'Real advice here.', authorName: 'Dawit' },
    });
    expect(result.id).toBe('exp-1');
  });

  it('creates a real row when hp is present but empty (a real user, not a bot)', async () => {
    (prisma.experience.create as any).mockResolvedValue({
      id: 'exp-2',
      authorName: null,
      content: 'Real advice here.',
      hiddenAt: null,
      createdAt: new Date(),
    });

    await createExperience({ content: 'Real advice here.', hp: '' } as any);

    expect(prisma.experience.create).toHaveBeenCalled();
  });

  it('does NOT write to the database when hp is non-empty, and returns a plausible fake result', async () => {
    const result = await createExperience({
      content: 'Looks like real advice.',
      authorName: 'Bot Name',
      hp: 'i am a bot',
    } as any);

    expect(prisma.experience.create).not.toHaveBeenCalled();
    expect(result.content).toBe('Looks like real advice.');
    expect(result.authorName).toBe('Bot Name');
    expect(result.id).toBeTruthy(); // present and plausible, just never persisted
  });

  it('treats whitespace-only hp the same as empty (still a real user)', async () => {
    (prisma.experience.create as any).mockResolvedValue({
      id: 'exp-3',
      authorName: null,
      content: 'Real advice.',
      hiddenAt: null,
      createdAt: new Date(),
    });

    await createExperience({ content: 'Real advice.', hp: '   ' } as any);

    expect(prisma.experience.create).toHaveBeenCalled();
  });
});

describe('listExperiences', () => {
  it('queries only non-hidden experiences, newest first', async () => {
    (prisma.experience.findMany as any).mockResolvedValue([]);
    await listExperiences({ limit: 20 } as any);

    expect(prisma.experience.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { hiddenAt: null },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('returns nextCursor: null when there are fewer results than the limit', async () => {
    (prisma.experience.findMany as any).mockResolvedValue([{ id: 'a' }, { id: 'b' }]);

    const result = await listExperiences({ limit: 20 } as any);
    expect(result.nextCursor).toBeNull();
    expect(result.items).toHaveLength(2);
  });

  it('returns a nextCursor and trims to the requested limit when more results exist', async () => {
    // limit 2, service should fetch 3 to detect "is there more"
    (prisma.experience.findMany as any).mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);

    const result = await listExperiences({ limit: 2 } as any);
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe('b'); // last item actually returned
  });

  it('passes the cursor through to prisma with skip: 1', async () => {
    (prisma.experience.findMany as any).mockResolvedValue([]);
    await listExperiences({ limit: 20, cursor: 'exp-123' } as any);

    expect(prisma.experience.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'exp-123' }, skip: 1 }),
    );
  });

  it('does not pass a cursor key at all when none was given', async () => {
    (prisma.experience.findMany as any).mockResolvedValue([]);
    await listExperiences({ limit: 20 } as any);

    const callArgs = (prisma.experience.findMany as any).mock.calls[0][0];
    expect(callArgs).not.toHaveProperty('cursor');
  });
});

describe('getExperienceById', () => {
  it('returns the experience when found and visible', async () => {
    (prisma.experience.findFirst as any).mockResolvedValue({ id: 'exp-1', hiddenAt: null });
    const result = await getExperienceById('exp-1');
    expect(result).not.toBeNull();
    expect(prisma.experience.findFirst).toHaveBeenCalledWith({
      where: { id: 'exp-1', hiddenAt: null },
    });
  });

  it('returns null when the experience is hidden (query excludes it, never reveals it exists)', async () => {
    (prisma.experience.findFirst as any).mockResolvedValue(null);
    const result = await getExperienceById('hidden-exp');
    expect(result).toBeNull();
  });

  it('returns null when the experience does not exist at all', async () => {
    (prisma.experience.findFirst as any).mockResolvedValue(null);
    const result = await getExperienceById('never-existed');
    expect(result).toBeNull();
  });
});

describe('hideExperience', () => {
  it('throws 404 if the experience does not exist', async () => {
    (prisma.experience.findUnique as any).mockResolvedValue(null);
    await expect(hideExperience('does-not-exist')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('sets hiddenAt on an existing, currently-visible experience', async () => {
    (prisma.experience.findUnique as any).mockResolvedValue({ id: 'exp-1', hiddenAt: null });
    await hideExperience('exp-1');

    expect(prisma.experience.update).toHaveBeenCalledWith({
      where: { id: 'exp-1' },
      data: { hiddenAt: expect.any(Date) },
    });
  });

  it('is idempotent — hiding an already-hidden experience succeeds without error', async () => {
    (prisma.experience.findUnique as any).mockResolvedValue({
      id: 'exp-1',
      hiddenAt: new Date('2026-01-01'),
    });
    await expect(hideExperience('exp-1')).resolves.not.toThrow();
  });
});
