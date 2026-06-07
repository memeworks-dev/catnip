import { prisma } from "@/lib/prisma";

/**
 * Share rate + approximate K-factor for a toy's dashboard (claude.md §10).
 *
 * Computed from our own first-party rows (Run, ShareEvent, ReturnEvent), not
 * PostHog — so the owner's numbers are reliable and independent of a visitor's
 * cookie-consent choice. PostHog is the product-analytics event stream;
 * this is the dashboard metric.
 *
 *   shareRate              = shares / runs
 *   sharesPerUser          = shares / users           (users = distinct run visitors)
 *   shareToReturnConversion = returningVisitors / shares
 *   kFactor (approx)       = sharesPerUser * shareToReturnConversion
 *
 * returningVisitors = distinct visitors who landed via a Catnip UTM link (§9).
 */
export interface ViralityMetrics {
  runs: number;
  shares: number;
  /** Distinct visitors who arrived via a Catnip UTM link. */
  returningVisitors: number;
  /** Distinct visitors who ran the toy. */
  users: number;
  shareRate: number;
  sharesPerUser: number;
  shareToReturnConversion: number;
  kFactor: number;
}

async function distinctCount(
  table: "runs" | "return_events",
  toyId: string,
): Promise<number> {
  // COUNT(DISTINCT visitor_id) cast to int so pg returns a JS number, not bigint.
  const rows =
    table === "runs"
      ? await prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(DISTINCT visitor_id)::int AS count FROM runs WHERE toy_id = ${toyId}`
      : await prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(DISTINCT visitor_id)::int AS count FROM return_events WHERE toy_id = ${toyId} AND visitor_id IS NOT NULL`;
  return rows[0]?.count ?? 0;
}

export async function getViralityMetrics(
  toyId: string,
): Promise<ViralityMetrics> {
  const [runs, shares, users, returningVisitors] = await Promise.all([
    prisma.run.count({ where: { toyId } }),
    prisma.shareEvent.count({ where: { toyId } }),
    distinctCount("runs", toyId),
    distinctCount("return_events", toyId),
  ]);

  const shareRate = runs > 0 ? shares / runs : 0;
  const sharesPerUser = users > 0 ? shares / users : 0;
  const shareToReturnConversion = shares > 0 ? returningVisitors / shares : 0;
  const kFactor = sharesPerUser * shareToReturnConversion;

  return {
    runs,
    shares,
    returningVisitors,
    users,
    shareRate,
    sharesPerUser,
    shareToReturnConversion,
    kFactor,
  };
}

/** shares / runs (§10). */
export async function getShareRate(toyId: string): Promise<number> {
  return (await getViralityMetrics(toyId)).shareRate;
}

/** Approximate K-factor (§10). */
export async function getKFactor(toyId: string): Promise<number> {
  return (await getViralityMetrics(toyId)).kFactor;
}
