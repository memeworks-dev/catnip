/** USD formatting for the dashboard — no hidden numbers (claude.md §11). */
export function formatUsd(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

/** Decimal → number helper (Prisma Decimal serialises as Decimal/string). */
export function toNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}
