import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import ApiError from '../../src/utils/ApiError.js';
import { HTTP_STATUS } from '../../src/constants/index.js';

const findUnique = vi.fn();
const update = vi.fn();

vi.mock('../../src/config/db.js', () => ({
  prisma: {
    user: {
      findUnique,
      update,
    },
  },
}));

const { getCurrentUser, updateDisplayName } = await import('../../src/services/user.service.js');

const baseRow = {
  id: 'user-1',
  name: 'Ada',
  email: 'ada@example.com',
  role: 'user',
  emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  passwordHash: 'secret-hash',
};

describe('user.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getCurrentUser returns public fields without passwordHash', async () => {
    findUnique.mockResolvedValue({
      id: baseRow.id,
      name: baseRow.name,
      email: baseRow.email,
      role: baseRow.role,
      emailVerifiedAt: baseRow.emailVerifiedAt,
      createdAt: baseRow.createdAt,
    });

    const result = await getCurrentUser('user-1');

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    });
    expect(result).toEqual({
      id: 'user-1',
      name: 'Ada',
      email: 'ada@example.com',
      role: 'user',
      emailVerifiedAt: baseRow.emailVerifiedAt,
      createdAt: baseRow.createdAt,
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('getCurrentUser throws 401 when the user row is missing', async () => {
    findUnique.mockResolvedValue(null);

    await expect(getCurrentUser('missing')).rejects.toMatchObject({
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      message: 'User no longer exists',
    });
    await expect(getCurrentUser('missing')).rejects.toBeInstanceOf(ApiError);
  });

  it('updateDisplayName updates only the name', async () => {
    update.mockResolvedValue({
      id: baseRow.id,
      name: 'New Name',
      email: baseRow.email,
      role: baseRow.role,
      emailVerifiedAt: baseRow.emailVerifiedAt,
      createdAt: baseRow.createdAt,
    });

    await updateDisplayName('user-1', 'New Name');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { name: 'New Name' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    });
    const data = update.mock.calls[0][0].data;
    expect(data).toEqual({ name: 'New Name' });
    expect(data).not.toHaveProperty('email');
    expect(data).not.toHaveProperty('passwordHash');
  });

  it('updateDisplayName result has no passwordHash', async () => {
    update.mockResolvedValue({
      id: baseRow.id,
      name: 'New Name',
      email: baseRow.email,
      role: baseRow.role,
      emailVerifiedAt: baseRow.emailVerifiedAt,
      createdAt: baseRow.createdAt,
    });

    const result = await updateDisplayName('user-1', 'New Name');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('updateDisplayName throws 404 when Prisma reports record not found', async () => {
    update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('No record', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(updateDisplayName('gone', 'Name')).rejects.toMatchObject({
      statusCode: HTTP_STATUS.NOT_FOUND,
      message: 'User not found',
    });
  });
});
