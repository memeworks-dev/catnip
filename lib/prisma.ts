import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { requireEnv } from "@/lib/env";

/**
 * Prisma client singleton.
 *
 * Prisma 7 ships without the Rust query engine, so the runtime client needs a
 * driver adapter — we use the pg adapter pointed at DATABASE_URL. The CLI gets
 * its URL from prisma.config.ts instead.
 *
 * A single instance is cached on globalThis in dev to survive HMR (otherwise
 * every reload opens a new pool and exhausts connections).
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg(requireEnv("DATABASE_URL"));
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
