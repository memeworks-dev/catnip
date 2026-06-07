import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth/clerk";
import { parseBrandConfig } from "@/lib/toy/brand";
import { getViralityMetrics } from "@/lib/analytics";
import { freeRunsRemaining, isFreeRun, computeChargeUsd } from "@/lib/metering/pricing";
import { estimateCostUsd } from "@/lib/generation";
import { toyUrl, embedSnippet } from "@/lib/embed";
import { formatUsd, toNumber } from "@/lib/format";
import { appConfig } from "@/lib/env";
import { parseRecords, isDomainsConfigured } from "@/lib/domains";
import { ToyForm } from "@/components/dashboard/toy-form";
import { CustomDomain } from "@/components/dashboard/custom-domain";
import {
  publishToy,
  pauseToy,
  resumeToy,
  killToy,
  updateToy,
} from "@/app/dashboard/actions";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  live: "bg-green-100 text-green-700",
  draft: "bg-neutral-100 text-neutral-600",
  paused: "bg-amber-100 text-amber-700",
  killed: "bg-red-100 text-red-700",
};

export default async function ToyDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const owner = await requireOwner();

  // TENANT ISOLATION (hard rule #8): scope by ownerId.
  const toy = await prisma.toy.findFirst({
    where: { id, ownerId: owner.ownerId },
  });
  if (!toy) notFound();

  const brand = parseBrandConfig(toy.brandConfig, toy.name);
  const metrics = await getViralityMetrics(toy.id);

  const cap = toNumber(toy.spendCapUsd);
  const used = toNumber(toy.spendUsedUsd);
  const reserved = toNumber(toy.spendReservedUsd);
  const freeRemaining = freeRunsRemaining(metrics.runs);
  const willBeFree = isFreeRun(metrics.runs);
  const projectedNext = willBeFree ? 0 : computeChargeUsd(estimateCostUsd({ prompt: "" }));
  const spendPct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard" className="text-sm text-neutral-500">
            ← All toys
          </Link>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-bold tracking-tight">
            {toy.name}
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                STATUS_STYLE[toy.status] ?? STATUS_STYLE.draft
              }`}
            >
              {toy.status}
            </span>
          </h1>
        </div>
        {toy.status === "live" ? (
          <a
            href={toyUrl(toy.slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium"
          >
            View public toy ↗
          </a>
        ) : null}
      </div>

      {/* Live numbers — no hidden numbers (§11). */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total runs" value={String(metrics.runs)} />
        <Stat
          label="Free runs remaining"
          value={String(freeRemaining)}
          hint={`first runs are free`}
        />
        <Stat
          label="Projected next-run cost"
          value={willBeFree ? "Free" : formatUsd(projectedNext)}
        />
        <Stat label="Share rate" value={`${(metrics.shareRate * 100).toFixed(1)}%`} hint={`${metrics.shares} shares`} />
        <Stat label="K-factor" value={metrics.kFactor.toFixed(2)} hint={`${metrics.returningVisitors} returning`} />
        <Stat
          label="Reserved (in-flight)"
          value={formatUsd(reserved)}
        />
      </div>

      {/* Spend vs cap */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-neutral-700">Spend used vs cap</span>
          <span className="text-neutral-600">
            {formatUsd(used)} / {formatUsd(cap)}
          </span>
        </div>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-neutral-900"
            style={{ width: `${spendPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Generation stops automatically at the cap — never a surprise bill.
        </p>
      </div>

      {/* Controls (§4B) */}
      <div className="flex flex-wrap gap-3">
        {toy.status === "draft" || toy.status === "paused" || toy.status === "killed" ? (
          <ControlButton
            action={toy.status === "draft" ? publishToy : resumeToy}
            toyId={toy.id}
            label={toy.status === "draft" ? "Publish" : "Resume"}
            className="bg-green-600 text-white"
          />
        ) : null}
        {toy.status === "live" ? (
          <ControlButton action={pauseToy} toyId={toy.id} label="Pause" className="bg-amber-500 text-white" />
        ) : null}
        {toy.status !== "killed" ? (
          <ControlButton action={killToy} toyId={toy.id} label="Kill" className="bg-red-600 text-white" />
        ) : null}
      </div>

      {/* Link + embed (§4B) */}
      {toy.status === "live" ? (
        <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5">
          <div>
            <h2 className="text-sm font-semibold text-neutral-700">Link</h2>
            <code className="mt-1 block break-all rounded-lg bg-neutral-50 p-3 text-sm">
              {toyUrl(toy.slug)}
            </code>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-700">Embed snippet</h2>
            <textarea
              readOnly
              rows={3}
              className="mt-1 w-full rounded-lg bg-neutral-50 p-3 font-mono text-xs"
              value={embedSnippet(toy.slug)}
            />
          </div>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-neutral-300 p-5 text-sm text-neutral-600">
          {toy.status === "draft"
            ? "Publish to get a shareable link and embed snippet."
            : "This toy isn’t live right now."}
        </p>
      )}

      {/* Custom domain (§2A) */}
      <CustomDomain
        toyId={toy.id}
        slug={toy.slug}
        rootDomain={appConfig.rootDomain}
        customDomain={toy.customDomain}
        domainStatus={toy.domainStatus}
        records={parseRecords(toy.domainDnsTarget)}
        configured={isDomainsConfigured()}
      />

      {/* Edit */}
      <details className="rounded-2xl border border-neutral-200 bg-white p-5">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-700">
          Customise toy
        </summary>
        <div className="mt-4">
          <ToyForm
            action={updateToy}
            submitLabel="Save changes"
            name={toy.name}
            brand={brand}
            perVisitorQuota={toy.perVisitorQuota}
            spendCapUsd={cap}
            toyId={toy.id}
          />
        </div>
      </details>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-neutral-400">{hint}</p> : null}
    </div>
  );
}

function ControlButton({
  action,
  toyId,
  label,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  toyId: string;
  label: string;
  className: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="toyId" value={toyId} />
      <button
        type="submit"
        className={`rounded-lg px-4 py-2 text-sm font-semibold ${className}`}
      >
        {label}
      </button>
    </form>
  );
}
