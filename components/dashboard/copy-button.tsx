"use client";

import { useState } from "react";

/** Small copy-to-clipboard button for DNS records / links (claude.md §2A). */
export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}
