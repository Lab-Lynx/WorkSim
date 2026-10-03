import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  // Prisma 7 requires a driver adapter for every connection — there is no
  // adapter-less fallback anymore. This uses DATABASE_URL (the transaction
  // pooler, port 6543) — the same split we set up earlier: DIRECT_URL is
  // reserved for prisma.config.ts and CLI commands (migrate, generate),
  // DATABASE_URL is for the running application and its tests.
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

// Reuses one client across module reloads in dev (tsx --watch). Without
// this guard, every file-save-triggered restart would create a brand new
// connection pool on top of the old one, until Supabase's pooler eventually
// rejects new connections — a classic, confusing "works for a while, then
// mysteriously breaks" bug.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}
