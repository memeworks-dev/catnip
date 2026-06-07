import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth/clerk";
import { formatUsd, toNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  live: "bg-green-100 text-green-700",
  draft: "bg-neutral-100 text-neutral-600",
  paused: "bg-amber-100 text-amber-700",
  killed: "bg-red-100 text-red-700",
};

/**
 * Dashboard home (claude.md §4B). Lists the owner's toys — scoped by ownerId
 * (tenant isolation, hard rule #8).
 */
export default async function DashboardHome() {
  const owner = await requireOwner();
  const toys = await prisma.toy.findMany({
    where: { ownerId: owner.ownerId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Your toys</h1>
        <Link
          href="/dashboard/new"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
        >
          + Create toy
        </Link>
      </div>

      {toys.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center">
          <p className="text-neutral-600">No toys yet.</p>
          <Link
            href="/dashboard/new"
            className="mt-4 inline-block rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Create your first toy
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {toys.map((toy) => (
            <li key={toy.id}>
              <Link
                href={`/dashboard/toys/${toy.id}`}
                className="block rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-400"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{toy.name}</h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      STATUS_STYLE[toy.status] ?? STATUS_STYLE.draft
                    }`}
                  >
                    {toy.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-neutral-500">/t/{toy.slug}</p>
                <p className="mt-3 text-sm text-neutral-600">
                  Spend {formatUsd(toNumber(toy.spendUsedUsd))} /{" "}
                  {formatUsd(toNumber(toy.spendCapUsd))}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
