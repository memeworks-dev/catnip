import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { requireEnv } from "@/lib/env";

/**
 * Prisma client singleton — LAZILY constructed.
 *
 * Prisma 7 ships without the Rust query engine, so the runtime client needs a
 * driver adapter — we use the pg adapter pointed at DATABASE_URL. The CLI gets
 * its URL from prisma.config.ts instead.
 *
 * The client is created on first use (first property access), NOT at import
 * time. This matters because `next build` imports every route module to collect
 * page data, and the build environment has no DATABASE_URL — constructing the
 * client at import would throw and fail the build. With the proxy below, only an
 * actual query requires DATABASE_URL (at request time).
 *
 * The instance is cached on globalThis in dev to survive HMR (otherwise every
 * reload opens a new pool and exhausts connections).
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg({
      connectionString: requireEnv("DATABASE_URL"),
      max: 20,
    });
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    // Bind top-level client methods ($transaction, $disconnect, …) to the real
    // client. Model delegates (prisma.toy, …) are objects and pass through.
    return typeof value === "function" ? value.bind(client) : value;
  },
});
