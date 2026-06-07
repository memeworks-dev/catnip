// Apply pending Prisma migrations during the Vercel build (claude.md §5, §12).
//
// Why a script and not just `prisma migrate deploy &&` in the build command:
//  - The app is designed to build WITHOUT a database (lazy Prisma client), so a
//    preview/build with no DATABASE_URL must still succeed — we skip cleanly.
//  - When DATABASE_URL *is* set (production), we apply migrations so the schema
//    exists before the first request. `migrate deploy` is idempotent: it only
//    applies migrations that haven't run yet, so it's safe on every deploy.
//
// Migrations use DIRECT_URL when present (see prisma.config.ts) — important for
// poolers like Supabase's transaction pooler, which can't run migrations.
import { execSync } from "node:child_process";

if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  console.warn(
    "[build] No DATABASE_URL/DIRECT_URL set — skipping `prisma migrate deploy`. " +
      "Set them in your Vercel project for the database-backed features to work.",
  );
  process.exit(0);
}

try {
  console.log("[build] Applying database migrations (prisma migrate deploy)…");
  execSync("prisma migrate deploy", { stdio: "inherit" });
} catch {
  console.error(
    "[build] `prisma migrate deploy` failed. Common causes:\n" +
      "  • DATABASE_URL points at a pooled connection that can't run migrations\n" +
      "    (e.g. Supabase port 6543) — set DIRECT_URL to the direct connection.\n" +
      "  • Wrong credentials / host, or the database is unreachable.",
  );
  process.exit(1);
}
