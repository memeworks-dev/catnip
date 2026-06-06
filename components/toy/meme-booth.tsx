"use client";

import { useEffect, useRef, useState } from "react";
import type { BrandConfig } from "@/lib/toy/brand";
import { submitMemeJob } from "@/app/t/[slug]/actions";
import {
  GracefulState,
  type GracefulStateKind,
} from "@/components/graceful-state";

interface ToySummary {
  id: string;
  name: string;
  slug: string;
}

type Step =
  | "form"
  | "generating"
  | "result"
  | "error"
  | "rejected"
  | "softwall";

const SOFT_WALL_KIND: Record<string, GracefulStateKind> = {
  spend_cap: "cap_reached",
  credits_out: "credits_out",
  quota_reached: "quota_reached",
  rate_limited: "rate_limited",
  paused: "paused",
  not_available: "not_available",
};

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 60_000;

/**
 * Public meme-booth toy UI (claude.md §4A), rendered from the toy's brand_config.
 * Generation is async (§2.3): submit creates a job, then we poll
 * /api/jobs/[jobId] until it's done (show result) or failed (graceful state).
 * The remaining hooks (quota, spend cap, moderation, share card, analytics)
 * attach to this flow in Phase 2 — see templates/meme-booth.md §7.
 */
export function MemeBooth({
  toy,
  brand,
}: {
  toy: ToySummary;
  brand: BrandConfig;
}) {
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [softWallKind, setSoftWallKind] =
    useState<GracefulStateKind>("cap_reached");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Set false to cancel an in-flight poll loop (reset / unmount).
  const pollingRef = useRef(false);

  // Local preview only — the source photo never leaves the browser in this
  // phase. Real generation uploads it server-side after moderation (§8, §14).
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  // Stop polling if the component unmounts.
  useEffect(() => {
    return () => {
      pollingRef.current = false;
    };
  }, []);

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoFile(file);
    setPhotoUrl(file ? URL.createObjectURL(file) : null);
  }

  async function pollJob(jobId: string) {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (pollingRef.current && Date.now() < deadline) {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as {
            status: string;
            resultUrl: string | null;
            failed?: boolean;
          };
          if (data.status === "done" && data.resultUrl) {
            setResultUrl(data.resultUrl);
            setStep("result");
            return;
          }
          if (data.failed) {
            setStep("error");
            return;
          }
        }
      } catch {
        // transient — keep polling until the deadline
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    if (pollingRef.current) setStep("error"); // timed out
  }

  async function onGenerate() {
    if (!photoFile) return;
    setStep("generating");
    // TODO: run Turnstile here before submitting (§8).
    const formData = new FormData();
    formData.append("slug", toy.slug);
    formData.append("name", name);
    formData.append("photo", photoFile);

    const res = await submitMemeJob(formData);
    if (!res.ok) {
      if (res.reason === "moderation_rejected") {
        setStep("rejected"); // §8 → "try a different photo"
      } else if (res.reason in SOFT_WALL_KIND) {
        // §7 soft walls: cap reached, credits out, quota, rate limit, paused.
        setSoftWallKind(SOFT_WALL_KIND[res.reason]);
        setStep("softwall");
      } else {
        setStep("error");
      }
      return;
    }
    pollingRef.current = true;
    await pollJob(res.jobId);
  }

  function reset() {
    pollingRef.current = false;
    setResultUrl(null);
    setStep("form");
  }

  function chooseAnotherPhoto() {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoFile(null);
    setPhotoUrl(null);
    reset();
  }

  const canGenerate = consent && photoFile !== null && step === "form";

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6 py-12"
      style={{ backgroundColor: brand.colors.background, color: brand.colors.text }}
    >
      <div className="w-full max-w-md">
        {/* Brand header */}
        <header className="mb-8 text-center">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logoUrl}
              alt={brand.brandName ?? toy.name}
              className="mx-auto mb-4 h-12 w-auto object-contain"
            />
          ) : null}
          <h1 className="text-3xl font-bold tracking-tight">
            {brand.copy.headline}
          </h1>
          <p className="mt-2 text-sm opacity-70">{brand.copy.subhead}</p>
        </header>

        {step === "form" || step === "generating" ? (
          <div className="space-y-5">
            {/* Photo upload */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                {brand.copy.uploadLabel}
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={step === "generating"}
                className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition hover:opacity-80 disabled:opacity-50"
                style={{ borderColor: brand.colors.primary }}
              >
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt="Your selfie"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm opacity-60">Tap to add a photo</span>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickPhoto}
              />
            </div>

            {/* Name */}
            <div>
              <label htmlFor="name" className="mb-2 block text-sm font-medium">
                {brand.copy.nameLabel}
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={brand.copy.namePlaceholder}
                disabled={step === "generating"}
                maxLength={40}
                className="w-full rounded-xl border px-4 py-3 text-base outline-none focus:ring-2 disabled:opacity-50"
                style={{ borderColor: brand.colors.primary }}
              />
            </div>

            {/* Consent (§14) */}
            <label className="flex items-start gap-3 text-sm opacity-80">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                disabled={step === "generating"}
                className="mt-1"
              />
              <span>{brand.copy.consent}</span>
            </label>

            {/* CTA */}
            <button
              type="button"
              onClick={onGenerate}
              disabled={!canGenerate}
              className="w-full rounded-xl px-4 py-4 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: brand.colors.primary }}
            >
              {step === "generating" ? "Cooking your meme…" : brand.copy.cta}
            </button>
            <p className="text-center text-xs opacity-40">Made with Catnip 🐈</p>
          </div>
        ) : null}

        {step === "result" && resultUrl ? (
          <ResultScreen
            imageUrl={resultUrl}
            brand={brand}
            toy={toy}
            onAgain={reset}
          />
        ) : null}

        {step === "error" ? (
          <div className="space-y-5 text-center">
            <h2 className="text-xl font-semibold">That didn&apos;t work</h2>
            <p className="text-sm opacity-70">
              Something went wrong making your meme. Give it another go.
            </p>
            <button
              type="button"
              onClick={reset}
              className="w-full rounded-xl px-4 py-3 font-semibold text-white"
              style={{ backgroundColor: brand.colors.primary }}
            >
              Try again
            </button>
          </div>
        ) : null}

        {step === "rejected" ? (
          <div className="space-y-5 text-center">
            <h2 className="text-xl font-semibold">Let&apos;s try a different photo</h2>
            <p className="text-sm opacity-70">
              That image didn&apos;t pass our checks. Please try another.
            </p>
            <button
              type="button"
              onClick={chooseAnotherPhoto}
              className="w-full rounded-xl px-4 py-3 font-semibold text-white"
              style={{ backgroundColor: brand.colors.primary }}
            >
              Choose another photo
            </button>
          </div>
        ) : null}

        {step === "softwall" ? <GracefulState kind={softWallKind} /> : null}
      </div>
    </main>
  );
}

function ResultScreen({
  imageUrl,
  brand,
  toy,
  onAgain,
}: {
  imageUrl: string;
  brand: BrandConfig;
  toy: ToySummary;
  onAgain: () => void;
}) {
  // Share links carry UTM params so returns are attributable (§9, §10).
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/t/${toy.slug}?utm_source=catnip&utm_toy=${toy.id}`
      : `/t/${toy.slug}`;
  const shareText = `Check out the meme I made${
    brand.brandName ? ` with ${brand.brandName}` : ""
  }!`;

  function copyLink() {
    void navigator.clipboard?.writeText(shareUrl);
  }

  return (
    <div className="space-y-5">
      {/* The watermark + attribution are baked into the share card image (§9). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Your meme"
        className="w-full rounded-2xl shadow-lg"
      />

      <div className="grid grid-cols-3 gap-2 text-sm font-medium">
        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
            shareText,
          )}&url=${encodeURIComponent(shareUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border px-3 py-3 text-center"
          style={{ borderColor: brand.colors.primary }}
        >
          Share on X
        </a>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(
            `${shareText} ${shareUrl}`,
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border px-3 py-3 text-center"
          style={{ borderColor: brand.colors.primary }}
        >
          WhatsApp
        </a>
        <button
          type="button"
          onClick={copyLink}
          className="rounded-xl border px-3 py-3 text-center"
          style={{ borderColor: brand.colors.primary }}
        >
          Copy link
        </button>
      </div>

      <button
        type="button"
        onClick={onAgain}
        className="w-full rounded-xl px-4 py-3 font-semibold text-white"
        style={{ backgroundColor: brand.colors.primary }}
      >
        Make another
      </button>

      {brand.brandUrl ? (
        <a
          href={brand.brandUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-sm underline opacity-70"
        >
          Visit {brand.brandName ?? "the brand"}
        </a>
      ) : null}

      <p className="text-center text-xs opacity-40">Made with Catnip 🐈</p>
    </div>
  );
}
