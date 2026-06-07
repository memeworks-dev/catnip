import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/auth/config";

/** Owner sign-in (Clerk, §5). Dev (no Clerk) → straight to the open dashboard. */
export default function SignInPage() {
  if (!isClerkConfigured()) redirect("/dashboard");
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <SignIn />
    </div>
  );
}
