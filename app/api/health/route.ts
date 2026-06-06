/**
 * Health check (claude.md §12). Liveness only — intentionally dependency-free so
 * it always responds even if a downstream service is down. The dashboard reads a
 * richer status flag separately.
 *
 * TODO: add a /api/health/ready that pings Postgres + Redis for readiness.
 */
export async function GET() {
  return Response.json({
    status: "ok",
    service: "catnip",
    time: new Date().toISOString(),
  });
}
