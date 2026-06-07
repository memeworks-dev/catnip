import Link from "next/link";
import { requireOwner } from "@/lib/auth/clerk";
import { parseBrandConfig } from "@/lib/toy/brand";
import { pricing } from "@/lib/env";
import { ToyForm } from "@/components/dashboard/toy-form";
import { createToy } from "@/app/dashboard/actions";

export const dynamic = "force-dynamic";

/**
 * Onboarding (claude.md §4B): create a toy from the meme-booth template,
 * customise brand, set quota + spend cap. Submitting creates a draft toy and
 * lands on its view, where the owner publishes to get a link + embed snippet.
 */
export default async function NewToyPage() {
  await requireOwner();
  const brand = parseBrandConfig({}, "My Meme Booth");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm text-neutral-500">
          ← Back
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          New toy · Meme Booth
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Customise it, set your limits, then publish. You can change everything
          later.
        </p>
      </div>

      <ToyForm
        action={createToy}
        submitLabel="Create toy"
        name="My Meme Booth"
        brand={brand}
        perVisitorQuota={pricing.defaultPerVisitorQuota}
        spendCapUsd={25}
      />
    </div>
  );
}
