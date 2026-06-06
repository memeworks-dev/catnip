/**
 * Graceful branded states (claude.md §12, hard rule #5). EVERY failure path on a
 * public toy resolves to one of these — never a stack trace. This is the single
 * component the toy renders for cap hit, credits out, quota reached, moderation
 * reject, generation failure, or provider down.
 *
 * Scaffold: copy is generic and unbranded; the real version reads the toy's
 * brand config (colours, logo, copy).
 */

export type GracefulStateKind =
  | "cap_reached"
  | "credits_out"
  | "quota_reached"
  | "rate_limited"
  | "moderation_rejected"
  | "generation_failed"
  | "provider_down"
  | "paused";

const COPY: Record<GracefulStateKind, { title: string; body: string }> = {
  cap_reached: {
    title: "Taking a quick break 🐈",
    body: "This toy is napping for now. Check back soon!",
  },
  credits_out: {
    title: "Taking a quick break 🐈",
    body: "This toy is napping for now. Check back soon!",
  },
  quota_reached: {
    title: "You've had your turn!",
    body: "You've used your free runs on this one.",
  },
  rate_limited: {
    title: "Whoa, slow down!",
    body: "Too many tries — give it a moment and retry.",
  },
  moderation_rejected: {
    title: "Let's try a different photo",
    body: "That image didn't pass our checks. Please try another.",
  },
  generation_failed: {
    title: "That didn't work",
    body: "Something went wrong making your meme. Give it another go.",
  },
  provider_down: {
    title: "Back in a moment",
    body: "We're having a hiccup. Please try again shortly.",
  },
  paused: {
    title: "Taking a quick break 🐈",
    body: "This toy is paused right now. Check back soon!",
  },
};

export function GracefulState({ kind }: { kind: GracefulStateKind }) {
  const { title, body } = COPY[kind];
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="mt-3 text-neutral-500">{body}</p>
    </div>
  );
}
