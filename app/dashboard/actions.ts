"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth/clerk";
import { uniqueSlug } from "@/lib/toy/slug";
import { pricing } from "@/lib/env";
import { isRedisConfigured } from "@/lib/redis";
import { setToyKilled } from "@/lib/metering/kill-switch";

/**
 * Dashboard mutations (claude.md §4B). TENANT ISOLATION (hard rule #8): every
 * action resolves the owner and scopes the toy by ownerId — an owner can only
 * ever touch their own toys.
 */

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function num(form: FormData, key: string, fallback: number): number {
  const raw = String(form.get(key) ?? "").trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) && raw !== "" ? parsed : fallback;
}

/** Build a brand_config JSON object from the onboarding/edit form. */
function brandFromForm(form: FormData) {
  // Use null (not undefined) for omitted fields — undefined isn't valid JSON.
  // parseBrandConfig() fills any null/missing field with the platform default.
  return {
    logoUrl: str(form, "logoUrl") || null,
    brandName: str(form, "brandName") || null,
    brandUrl: str(form, "brandUrl") || null,
    promptStyle: str(form, "promptStyle") || null,
    colors: {
      primary: str(form, "colorPrimary") || "#7C3AED",
      background: str(form, "colorBackground") || "#FFFFFF",
      text: str(form, "colorText") || "#0A0A0A",
      accent: str(form, "colorAccent") || "#F59E0B",
    },
    copy: {
      headline: str(form, "copyHeadline") || null,
      subhead: str(form, "copySubhead") || null,
      cta: str(form, "copyCta") || null,
    },
  };
}

/** Resolve a toy that belongs to the current owner, or 404. */
async function ownedToy(toyId: string, ownerId: string) {
  const toy = await prisma.toy.findFirst({ where: { id: toyId, ownerId } });
  if (!toy) notFound();
  return toy;
}

export async function createToy(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const name = str(form, "name") || "My Meme Booth";

  const toy = await prisma.toy.create({
    data: {
      ownerId: owner.ownerId,
      name,
      slug: await uniqueSlug(name),
      templateId: "meme-booth",
      status: "draft",
      brandConfig: brandFromForm(form),
      perVisitorQuota: Math.max(
        1,
        Math.round(num(form, "perVisitorQuota", pricing.defaultPerVisitorQuota)),
      ),
      spendCapUsd: Math.max(0, num(form, "spendCapUsd", 25)),
    },
  });

  redirect(`/dashboard/toys/${toy.id}`);
}

export async function updateToy(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const toyId = str(form, "toyId");
  const toy = await ownedToy(toyId, owner.ownerId);

  await prisma.toy.update({
    where: { id: toy.id },
    data: {
      name: str(form, "name") || toy.name,
      brandConfig: brandFromForm(form),
      perVisitorQuota: Math.max(
        1,
        Math.round(num(form, "perVisitorQuota", toy.perVisitorQuota)),
      ),
      spendCapUsd: Math.max(0, num(form, "spendCapUsd", Number(toy.spendCapUsd))),
    },
  });

  revalidatePath(`/dashboard/toys/${toy.id}`);
}

export async function publishToy(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const toy = await ownedToy(str(form, "toyId"), owner.ownerId);
  await prisma.toy.update({ where: { id: toy.id }, data: { status: "live" } });
  if (isRedisConfigured()) await setToyKilled(toy.id, false);
  revalidatePath(`/dashboard/toys/${toy.id}`);
}

export async function pauseToy(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const toy = await ownedToy(str(form, "toyId"), owner.ownerId);
  await prisma.toy.update({ where: { id: toy.id }, data: { status: "paused" } });
  revalidatePath(`/dashboard/toys/${toy.id}`);
}

export async function resumeToy(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const toy = await ownedToy(str(form, "toyId"), owner.ownerId);
  await prisma.toy.update({ where: { id: toy.id }, data: { status: "live" } });
  if (isRedisConfigured()) await setToyKilled(toy.id, false);
  revalidatePath(`/dashboard/toys/${toy.id}`);
}

export async function killToy(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const toy = await ownedToy(str(form, "toyId"), owner.ownerId);
  await prisma.toy.update({ where: { id: toy.id }, data: { status: "killed" } });
  // Instant cache flag so generation stops immediately (§7), best-effort.
  if (isRedisConfigured()) await setToyKilled(toy.id, true);
  revalidatePath(`/dashboard/toys/${toy.id}`);
}
