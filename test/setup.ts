// Vitest setup: load .env so DATABASE_URL is available to the Prisma client.
// In CI, the vars are usually already in the environment, so a missing .env
// file is fine.
try {
  process.loadEnvFile();
} catch {
  // rely on the ambient environment
}
