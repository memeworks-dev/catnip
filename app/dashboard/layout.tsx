import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { requireOwner } from "@/lib/auth/clerk";
import { isClerkConfigured } from "@/lib/auth/config";

/**
 * Dashboard chrome + auth gate (claude.md §4B, §5). requireOwner() redirects to
 * sign-in when Clerk is configured and the visitor isn't authed; in dev (no
 * Clerk) it resolves a local owner so the dashboard is usable.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const owner = await requireOwner();

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight">
            Catnip 🐈 <span className="text-neutral-400">Dashboard</span>
          </Link>
          {isClerkConfigured() ? (
            <UserButton />
          ) : (
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-500">
              dev · {owner.email}
            </span>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
