import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { isClerkConfigured } from "@/lib/auth/config";

/**
 * Auth (claude.md §5): Clerk guards the dashboard only — toys are public. Clerk
 * handles magic link / email+password / Google OAuth, verification, password
 * reset, and sessions, so there is no custom auth code to build (hard rule #9).
 *
 * requireOwner() maps the signed-in user to their local Owner row and is the
 * basis for tenant isolation (§13, hard rule #8): every dashboard query scopes by
 * the returned ownerId.
 */
export { auth, currentUser } from "@clerk/nextjs/server";
export { isClerkConfigured } from "@/lib/auth/config";

export interface OwnerContext {
  ownerId: string;
  email: string;
}

/** Dev-only owner used when Clerk isn't configured (matches the seed). */
const DEV_OWNER_EMAIL = "demo@catnip.io";

export async function requireOwner(): Promise<OwnerContext> {
  if (isClerkConfigured()) {
    const { userId } = await auth();
    if (!userId) {
      redirect("/sign-in");
    }
    const user = await currentUser();
    const email =
      user?.primaryEmailAddress?.emailAddress ??
      user?.emailAddresses[0]?.emailAddress;
    if (!email) {
      throw new Error("Signed-in user has no email address");
    }
    const owner = await prisma.owner.upsert({
      where: { email },
      update: {},
      create: { email },
    });
    return { ownerId: owner.id, email };
  }

  // Dev-open fallback (no Clerk): a stable local owner so the dashboard works.
  const owner = await prisma.owner.upsert({
    where: { email: DEV_OWNER_EMAIL },
    update: {},
    create: { email: DEV_OWNER_EMAIL },
  });
  return { ownerId: owner.id, email: DEV_OWNER_EMAIL };
}
