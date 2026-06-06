/**
 * Owner dashboard (claude.md §4B). The paying customer creates/customises toys,
 * sets cap + quota, publishes, and sees live usage with NO hidden numbers (§11).
 *
 * Scaffold placeholder. When auth is built this lives behind Clerk
 * (clerkMiddleware + requireOwner) and every query is scoped to the owner for
 * tenant isolation (§13, hard rule #8).
 */
export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <p className="mt-4 text-neutral-600">
        Owner dashboard scaffold. To be built: create a toy from a template,
        customise brand, set per-visitor quota and hard spend cap, publish, and
        watch live runs / free runs remaining / spend vs cap / projected next-run
        cost / share rate / K-factor.
      </p>
      <p className="mt-4 text-sm text-neutral-400">
        TODO: gate behind Clerk auth (§5) and scope every query by owner (§13).
      </p>
    </main>
  );
}
