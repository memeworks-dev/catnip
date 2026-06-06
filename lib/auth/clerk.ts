import { NotImplementedError } from "@/lib/errors";

/**
 * Auth (claude.md §5): Clerk guards the dashboard only — toys are public. Clerk
 * handles magic link / email+password / Google OAuth, verification, password
 * reset, and sessions, so there is no custom auth code to build (hard rule #9).
 *
 * Re-export Clerk server helpers from one place, and add the mapping from a
 * Clerk user to our local Owner row used for tenant isolation (§13, hard #8).
 *
 * NOTE: ClerkProvider + clerkMiddleware are intentionally NOT mounted yet, so
 * the app boots without Clerk keys. Add them when the dashboard is built.
 */
export { auth, currentUser } from "@clerk/nextjs/server";

export interface OwnerContext {
  ownerId: string;
  email: string;
}

/**
 * Resolve the signed-in dashboard user to their Owner row, creating it on first
 * sign-in. Throws if not authenticated. Every dashboard query must scope by the
 * returned ownerId (tenant isolation, §13).
 *
 * TODO: read Clerk session via auth(), upsert Owner by email/clerk id.
 */
export async function requireOwner(): Promise<OwnerContext> {
  throw new NotImplementedError("auth.requireOwner");
}
