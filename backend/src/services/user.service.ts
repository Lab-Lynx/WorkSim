import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';

/*
 * NOTE ON LAYERING: Prisma is called directly from this service until the
 * team decides on a repo layer (same approach as auth.service.ts).
 */

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  emailVerifiedAt: true,
  createdAt: true,
} as const;

export type PublicUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
};

export const getCurrentUser = async (userId: string): Promise<PublicUser> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });

  // Match auth.service getUserById: authenticated session whose user row is
  // gone is treated as unauthorized, not as a public 404.
  if (!user) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'User no longer exists');
  }

  return user;
};

export const updateDisplayName = async (
  userId: string,
  name: string,
): Promise<PublicUser> => {
  try {
    return await prisma.user.update({
      where: { id: userId },
      data: { name },
      select: publicUserSelect,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
    }
    throw err;
  }
};
