"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { DnsRecord } from "@/lib/domains";
import {
  addCustomDomain,
  checkCustomDomain,
  removeCustomDomain,
  type DomainActionState,
} from "@/app/dashboard/actions";

type DomainStatus = "none" | "pending" | "verifying" | "verified" | "error";

interface CustomDomainProps {
  toyId: string;
  slug: string;
  rootDomain: string;
  customDomain: string | null;
  domainStatus: DomainStatus;
  records: DnsRecord[];
  /** Whether VERCEL_API_TOKEN + VERCEL_PROJECT_ID are set. */
  configured: boolean;
}

const STATUS_BADGE: Record<DomainStatus, string> = {
  none: "bg-neutral-100 text-neutral-600",
  pending: "bg-amber-100 text-amber-700",
  verifying: "bg-blue-100 text-blue-700",
  verified: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<DomainStatus, string> = {
  none: "Not set",
  pending: "Pending DNS",
  verifying: "Verifying",
  verified: "Verified",
  error: "Action needed",
};

const STATUS_HELP: Record<DomainStatus, string> = {
  none: "",
  pending:
    "Add the DNS record below at your registrar, then click Check now. DNS can take a few minutes to propagate.",
  verifying: "DNS detected — finishing verification and provisioning SSL. This usually takes a minute.",
  verified: "Live with automatic SSL. Your toy now serves on this domain.",
  error:
    "We couldn’t verify this domain. Double-check the DNS record below and click Check now.",
};

/**
 * Custom-domain manager for the toy dashboard (claude.md §2A). Lets an owner
 * attach their own domain, shows the exact DNS record to set with copy buttons
 * and a clear pending/verifying/verified/error state, re-checks on demand, and
 * removes the domain. The toy keeps serving on its catnip.io slug until verified.
 */
export function CustomDomain({
  toyId,
  slug,
  rootDomain,
  customDomain,
  domainStatus,
  records,
  configured,
}: CustomDomainProps) {
  const subdomainUrl = `${slug}.${rootDomain}`;

  return (
    <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold text-neutral-700">Custom domain</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Serve this toy on your own domain (e.g.{" "}
          <code className="rounded bg-neutral-100 px-1">meme.yourbrand.com</code>) with
          automatic SSL.
        </p>
      </div>

      {!customDomain ? (
        <AddDomainForm toyId={toyId} configured={configured} subdomainUrl={subdomainUrl} />
      ) : (
        <ManageDomain
          toyId={toyId}
          customDomain={customDomain}
          domainStatus={domainStatus}
          records={records}
          subdomainUrl={subdomainUrl}
        />
      )}
    </section>
  );
}

function AddDomainForm({
  toyId,
  configured,
  subdomainUrl,
}: {
  toyId: string;
  configured: boolean;
  subdomainUrl: string;
}) {
  const [state, formAction] = useActionState<DomainActionState, FormData>(
    addCustomDomain,
    { ok: false },
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="toyId" value={toyId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          name="domain"
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="meme.yourbrand.com"
          disabled={!configured}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 disabled:bg-neutral-50"
        />
        <SubmitButton
          label="Add domain"
          pendingLabel="Adding…"
          disabled={!configured}
          className="bg-neutral-900 text-white"
        />
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {!configured ? (
        <p className="text-xs text-neutral-500">
          Set <code>VERCEL_API_TOKEN</code> and <code>VERCEL_PROJECT_ID</code> to enable
          custom domains.
        </p>
      ) : (
        <p className="text-xs text-neutral-500">
          Your toy is always available at{" "}
          <code className="rounded bg-neutral-100 px-1">{subdomainUrl}</code>.
        </p>
      )}
    </form>
  );
}

function ManageDomain({
  toyId,
  customDomain,
  domainStatus,
  records,
  subdomainUrl,
}: {
  toyId: string;
  customDomain: string;
  domainStatus: DomainStatus;
  records: DnsRecord[];
  subdomainUrl: string;
}) {
  const verified = domainStatus === "verified";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {verified ? (
            <a
              href={`https://${customDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-neutral-900 underline"
            >
              {customDomain} ↗
            </a>
          ) : (
            <span className="font-medium text-neutral-900">{customDomain}</span>
          )}
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[domainStatus]}`}
          >
            {STATUS_LABEL[domainStatus]}
          </span>
        </div>
        <div className="flex gap-2">
          {!verified ? (
            <form action={checkCustomDomain}>
              <input type="hidden" name="toyId" value={toyId} />
              <SubmitButton
                label="Check now"
                pendingLabel="Checking…"
                className="border border-neutral-300 text-neutral-800"
              />
            </form>
          ) : null}
          <form
            action={removeCustomDomain}
            onSubmit={(e) => {
              if (!confirm(`Remove ${customDomain} from this toy?`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="toyId" value={toyId} />
            <SubmitButton
              label="Remove"
              pendingLabel="Removing…"
              className="border border-neutral-300 text-red-600"
            />
          </form>
        </div>
      </div>

      {STATUS_HELP[domainStatus] ? (
        <p className="text-sm text-neutral-600">{STATUS_HELP[domainStatus]}</p>
      ) : null}

      {!verified && records.length > 0 ? (
        <DnsRecords records={records} />
      ) : null}

      {!verified ? (
        <p className="text-xs text-neutral-500">
          Until this domain is verified, your toy stays live at{" "}
          <code className="rounded bg-neutral-100 px-1">{subdomainUrl}</code> — you’re
          never blocked.
        </p>
      ) : null}
    </div>
  );
}

function DnsRecords({ records }: { records: DnsRecord[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200">
      <div className="grid grid-cols-[5rem_1fr_1.5fr] gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        <span>Type</span>
        <span>Name</span>
        <span>Value</span>
      </div>
      {records.map((record, i) => (
        <div
          key={`${record.type}-${record.name}-${i}`}
          className="grid grid-cols-[5rem_1fr_1.5fr] items-center gap-2 px-3 py-2 text-sm"
        >
          <span className="font-mono text-neutral-700">{record.type}</span>
          <CopyValue value={record.name} />
          <CopyValue value={record.value} />
        </div>
      ))}
    </div>
  );
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — the value is still selectable on screen
    }
  }

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <code className="truncate rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-800">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${value}`}
        className="shrink-0 rounded border border-neutral-300 px-1.5 py-0.5 text-xs text-neutral-600 hover:bg-neutral-50"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}

function SubmitButton({
  label,
  pendingLabel,
  className,
  disabled,
}: {
  label: string;
  pendingLabel: string;
  className: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
