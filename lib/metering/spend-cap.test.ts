import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { reserve } from "@/lib/metering/spend-cap";

/**
 * The sacred path (claude.md §7, hard rule #1): the hard spend cap must be
 * impossible to bypass under ANY concurrency. This fires many simultaneous
 * reservations at a toy near its cap and asserts the cap is never exceeded.
 *
 * Requires a real Postgres (DATABASE_URL) — run with `npm test`.
 */
describe("spend cap — reserve under concurrency (§7)", () => {
  const CAP = 10;
  const CHARGE = 1; // exactly CAP/CHARGE = 10 reservations fit
  let ownerId = "";
  let toyId = "";

  beforeAll(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const owner = await prisma.owner.create({
      data: { email: `cap-test-${stamp}@example.com`, creditBalanceUsd: 1_000_000 },
    });
    ownerId = owner.id;
    const toy = await prisma.toy.create({
      data: {
        ownerId,
        name: "Cap Test",
        slug: `cap-test-${stamp}`,
        templateId: "meme-booth",
        status: "live",
        spendCapUsd: CAP,
      },
    });
    toyId = toy.id;
  });

  afterAll(async () => {
    if (toyId) await prisma.toy.deleteMany({ where: { id: toyId } });
    if (ownerId) await prisma.owner.deleteMany({ where: { id: ownerId } });
    await prisma.$disconnect();
  });

  it("never exceeds the cap when many requests fire at once", async () => {
    const N = 40; // far more than the 10 that fit
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        reserve({ toyId, ownerId, chargeUsd: CHARGE, isFree: false }),
      ),
    );

    const accepted = results.filter((r) => r.ok).length;
    const softWalled = results.filter((r) => !r.ok).length;

    // Exactly the cap's worth succeed; everyone else gets a graceful soft wall.
    expect(accepted).toBe(CAP / CHARGE);
    expect(softWalled).toBe(N - CAP / CHARGE);

    const toy = await prisma.toy.findUniqueOrThrow({ where: { id: toyId } });
    // THE INVARIANT: reserved never exceeds the cap, and matches the accepted count.
    expect(Number(toy.spendReservedUsd)).toBeLessThanOrEqual(CAP);
    expect(Number(toy.spendReservedUsd)).toBe(accepted * CHARGE);

    // The cap is full: one more reservation is refused with the cap soft wall.
    const extra = await reserve({ toyId, ownerId, chargeUsd: CHARGE, isFree: false });
    expect(extra.ok).toBe(false);
    if (!extra.ok) expect(extra.reason).toBe("spend_cap");
  });

  it("free runs (charge 0) never consume cap budget", async () => {
    // The cap is already full from the previous test; a free run still passes.
    const free = await reserve({ toyId, ownerId, chargeUsd: 0, isFree: true });
    expect(free.ok).toBe(true);

    const toy = await prisma.toy.findUniqueOrThrow({ where: { id: toyId } });
    expect(Number(toy.spendReservedUsd)).toBeLessThanOrEqual(CAP);
  });
});
