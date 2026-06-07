/**
 * Health check (claude.md §12). Liveness only — intentionally dependency-free so
 * it always responds even if a downstream service is down. The dashboard reads a
 * richer status flag separately.
 *
 * See /api/health/ready for a readiness probe that checks Postgres connectivity
 * and that the schema has been migrated.
 */
export async function GET() {
  return Response.json({
    status: "ok",
    service: "catnip",
    time: new Date().toISOString(),
  });
}
