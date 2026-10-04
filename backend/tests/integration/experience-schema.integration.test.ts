import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { resetDatabase } from '../helpers/db';

beforeEach(async () => {
  await resetDatabase();
});

describe('Experience schema', () => {
  it('creates an experience with just content, defaulting authorName and hiddenAt to null', async () => {
    const exp = await prisma.experience.create({
      data: { content: 'This is a piece of advice that is definitely long enough.' },
    });
    expect(exp.authorName).toBeNull();
    expect(exp.hiddenAt).toBeNull();
    expect(exp.id).toBeTruthy();
  });

  it('rejects content longer than 2000 characters at the database level', async () => {
    const tooLong = 'a'.repeat(2001);
    await expect(prisma.experience.create({ data: { content: tooLong } })).rejects.toThrow();
  });

  it('rejects an authorName longer than 80 characters at the database level', async () => {
    const tooLong = 'a'.repeat(81);
    await expect(
      prisma.experience.create({
        data: { content: 'Valid content long enough to pass.', authorName: tooLong },
      }),
    ).rejects.toThrow();
  });

  it('setting hiddenAt marks a row moderated without deleting it', async () => {
    const exp = await prisma.experience.create({
      data: { content: 'Valid content long enough to pass.' },
    });
    const hidden = await prisma.experience.update({
      where: { id: exp.id },
      data: { hiddenAt: new Date() },
    });
    expect(hidden.hiddenAt).not.toBeNull();

    const stillExists = await prisma.experience.findUnique({ where: { id: exp.id } });
    expect(stillExists).not.toBeNull(); // soft-delete, not a hard delete
  });
});
