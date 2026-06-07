import type { Toy } from "@prisma/client";
import { dnsRecordFor } from "@/lib/domains";
import { CopyButton } from "@/components/dashboard/copy-button";
import {
  attachDomain,
  verifyDomain,
  detachDomain,
} from "@/app/dashboard/domain-actions";

/**
 * Custom-domain panel for the toy view (claude.md §2A). Add a domain, see the
 * exact DNS record with copy buttons and a pending/verifying/verified/error
 * state, check now, or remove. Never a dead end: the record + actions stay
 * visible until verified, and the toy keeps serving on its catnip.io slug.
 */

const STATUS: Record<string, { label: string; className: string; note: string }> = {
  pending: {
    label: "Pending",
    className: "bg-amber-100 text-amber-700",
    note: "Add the DNS record below at your registrar, then check again.",
  },
  verifying: {
    label: "Verifying",
    className: "bg-blue-100 text-blue-700",
    note: "DNS detected — verifying and provisioning SSL. This can take a few minutes.",
  },
  verified: {
    label: "Verified",
    className: "bg-green-100 text-green-700",
    note: "Live with SSL. Your toy now serves on this domain.",
  },
  error: {
    label: "Needs attention",
    className: "bg-red-100 text-red-700",
    note: "We couldn't verify the domain. Double-check the DNS record and retry.",
  },
};

export function DomainSection({
  toy,
  domainError,
}: {
  toy: Toy;
  domainError?: string;
}) {
  const hasDomain = Boolean(toy.customDomain) && toy.domainStatus !== "none";

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-neutral-700">Custom domain</h2>

      {!hasDomain ? (
        <form action={attachDomain} className="space-y-3">
          <input type="hidden" name="toyId" value={toy.id} />
          <p className="text-sm text-neutral-600">
            Serve this toy on your own domain instead of the catnip.io link.
          </p>
          <div className="flex gap-2">
            <input
              name="domain"
              placeholder="meme.yourbrand.com"
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
            <button
              type="submit"
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Add domain
            </button>
          </div>
          {domainError ? (
            <p className="text-sm text-red-600">{domainError}</p>
          ) : null}
        </form>
      ) : (
        <DomainDetail toy={toy} domainError={domainError} />
      )}
    </div>
  );
}

function DomainDetail({ toy, domainError }: { toy: Toy; domainError?: string }) {
  const domain = toy.customDomain as string;
  const record = dnsRecordFor(domain);
  const status = STATUS[toy.domainStatus] ?? STATUS.pending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <code className="break-all text-sm font-medium">{domain}</code>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
          {status.label}
        </span>
      </div>

      <p className="text-sm text-neutral-600">{status.note}</p>
      {domainError ? <p className="text-sm text-red-600">{domainError}</p> : null}

      {toy.domainStatus !== "verified" ? (
        <div className="rounded-xl bg-neutral-50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            DNS record to add
          </p>
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 text-sm">
            <DnsCell label="Type" value={record.type} />
            <DnsCell label="Name" value={record.name} />
            <DnsCell label="Value" value={record.value} />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {toy.domainStatus !== "verified" ? (
          <form action={verifyDomain}>
            <input type="hidden" name="toyId" value={toy.id} />
            <button
              type="submit"
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Check now
            </button>
          </form>
        ) : null}
        <form action={detachDomain}>
          <input type="hidden" name="toyId" value={toy.id} />
          <button
            type="submit"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700"
          >
            Remove
          </button>
        </form>
      </div>
    </div>
  );
}

function DnsCell({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <code className="break-all rounded bg-white px-2 py-1 text-sm">{value}</code>
      <CopyButton value={value} />
    </>
  );
}
