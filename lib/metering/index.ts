/**
 * Metering & governance (claude.md §7, §11) — the differentiator. Re-exports the
 * spend cap, quota, kill switch, and pricing math from one place.
 */

export * from "@/lib/metering/pricing";
export * from "@/lib/metering/quota";
export * from "@/lib/metering/kill-switch";
export * as spendCap from "@/lib/metering/spend-cap";
