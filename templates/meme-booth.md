# Template: Meme Booth

> **Status: first-pass (Phase 1).** This exists so the multi-tenant shell has a
> template to render against; generation is stubbed until Phase 2. The polished,
> on-brand version is refined later using the live platform (claude.md §16,
> sequencing note). Format follows claude.md §16.

---

## 1. Toy identity

- **Name:** Meme Booth
- **One-liner:** Upload a photo, get cooked into a personalised, on-brand meme.
- **Emotion:** delight + "I have to send this to someone." The result is funny,
  flattering-enough, and instantly shareable.

## 2. User flow (public end-user)

1. Land on the toy (brand logo, colours, hook copy).
2. Give **consent** to process the photo (§14) and pass the **Turnstile** check.
3. Upload a photo and/or enter a name.
4. Tap **Make my meme**. A graceful loading state shows while the async job runs.
5. See the result with a watermarked **share card** and brand attribution.
6. **Share** (X, WhatsApp, Instagram, copy link) — links carry UTM params.
7. Soft wall after the per-visitor quota; brand CTA back to the owner's site.

## 3. Generation contract

The exact prompt fed to the image model (via `generateImage()`, never a direct
SDK call — hard rule #2). Slots in `{{ }}` are filled from user input + brand
config.

```
Create a single high-quality meme image of the person in the uploaded photo.
Style: {{brand.prompt_style | default: "bold, playful, internet-meme"}}.
Scene/joke: {{template.scene | default: "epic hero trading-card of the subject"}}.
Keep the subject clearly recognisable (self-insert). Flattering, fun, safe-for-work.
Brand palette: {{brand.colours}}. Leave clear space for the caption.
Caption text: {{user.name | default: ""}}.
Do NOT depict minors, nudity, violence, hate, or real public figures other than
the uploaded subject.
Output: one image, {{template.aspect_ratio | default: "1:1"}}.
```

- Source photo passed as `imageBytes` (self-insert).
- Cost recorded EXACTLY on the result (`costUsd`) — the business runs on this (§1).

## 4. Share card spec (Vercel OG)

- Canvas: the generated meme as the hero.
- **"Made with Catnip"** watermark — bottom corner, on by default (§9).
- **Brand attribution**: owner logo + name, linking back to `brand.brand_url`.
- Optional caption/name band.
- Stored in R2 behind a signed URL; referenced as `Run.shareCardUrl`.

## 5. Self-insert defaults

The subject is the user: their uploaded face is the centre of the meme, optional
name in the caption. Self-insert is on by default (§9).

## 6. Brand customisation surface (no code)

Owner can change via `Toy.brandConfig`: `logo`, `colours`, `copy` (hook +
CTA), `prompt_style`, `brand_url`. Everything else is fixed by this template.

## 7. Required Catnip hooks (non-optional — §16.7)

The toy MUST call, in order:

1. **Per-visitor quota** check (`lib/metering` quota) — before reserving.
2. **Spend-cap reservation** (`lib/metering` spend cap: reserve → generate →
   reconcile) — generation cannot start without a successful reserve (§7).
3. **Input moderation** (`moderateImage()`, fail closed) — reject NSFW,
   violence, and any apparent minor; never store such images (§8).
4. **Generation job** submission (QStash → `processGenerationJob`).
5. **Output moderation** (`moderateImage()` on the result) before display/share.
6. **Share-card generation** (Vercel OG) with watermark + attribution.
7. **Analytics events**: `run`, `share`, `return` (§10).

## 8. Guardrails

- Moderation is fail-closed on every stage (§8).
- Turnstile + per-IP / per-toy rate limits before generation (§7, §13).
- Spend cap is impossible to exceed under load (§7, hard rule #1).
- Every failure → a branded graceful state (`components/graceful-state`), never a
  raw error (§12, hard rule #5).
- Source photo deleted promptly after generation; results honour the retention
  window (§14).

---

_TODO (Phase 2+): tighten the generation contract with concrete scene presets so
the agent produces a deployable, on-brand meme booth every time (§20)._
