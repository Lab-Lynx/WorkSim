import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { ApiError } from '../lib/errors/ApiError';
import type {
  CreateExperienceInput,
  ListExperiencesQuery,
} from '../validators/experience.validators';

export interface ExperienceResult {
  id: string;
  authorName: string | null;
  content: string;
  createdAt: Date;
}

export async function createExperience(input: CreateExperienceInput): Promise<ExperienceResult> {
  if (input.hp && input.hp.trim().length > 0) {
    // Honeypot tripped: a real visitor never populates this field, since
    // it's invisible to them. Respond with a plausible-looking result
    // without ever touching the database — the bot gets what looks like
    // a normal success and has no signal its submission was discarded.
    return {
      id: crypto.randomUUID(),
      authorName: input.authorName ?? null,
      content: input.content,
      createdAt: new Date(),
    };
  }

  return prisma.experience.create({
    data: { content: input.content, authorName: input.authorName },
  });
}

export async function listExperiences(
  query: ListExperiencesQuery,
): Promise<{ items: ExperienceResult[]; nextCursor: string | null }> {
  const items = await prisma.experience.findMany({
    where: { hiddenAt: null },
    orderBy: { createdAt: 'desc' },
    take: query.limit + 1, // fetch one extra to detect "is there a next page"
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });

  const hasMore = items.length > query.limit;
  const page = hasMore ? items.slice(0, query.limit) : items;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  return { items: page, nextCursor };
}

export async function getExperienceById(id: string): Promise<ExperienceResult | null> {
  // hiddenAt: null is part of the WHERE clause itself, not a post-fetch
  // check — a hidden experience's existence is never revealed, even via
  // a 404-vs-410 distinction. It's simply "not found," full stop.
  return prisma.experience.findFirst({ where: { id, hiddenAt: null } });
}

export async function hideExperience(id: string): Promise<void> {
  const existing = await prisma.experience.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError(404, 'Experience not found');
  }

  await prisma.experience.update({
    where: { id },
    data: { hiddenAt: new Date() },
  });
}
