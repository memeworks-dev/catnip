import { defineConfig } from "prisma/config";

// Prisma 7 no longer reads connection URLs from schema.prisma, and the CLI no
// longer auto-loads .env. Load it ourselves (Node >= 20.12 ships loadEnvFile).
// In CI/prod the vars are usually already in the environment, so a missing
// .env file is not an error.
try {
  process.loadEnvFile();
} catch {
  // no .env file present — rely on the ambient environment
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Used by migrate / introspect / studio. Read directly (not via the throwing
  // env() helper) so `prisma generate` still works with no DATABASE_URL set —
  // generate doesn't touch the DB. Migrate commands error clearly if it's unset.
  // The runtime client gets its URL via the pg driver adapter in lib/prisma.ts.
  //
  // Prefer DIRECT_URL for migrations: poolers (e.g. Supabase's transaction pooler
  // on :6543) can't run migrations, so set DIRECT_URL to the direct connection
  // while DATABASE_URL stays the pooled runtime URL. Falls back to DATABASE_URL.
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
