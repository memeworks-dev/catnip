# Template: Meme Booth

> **Catnip toy template spec.** A template is a markdown file that steers a
> coding agent to generate a complete, on-brand toy that plugs into every Catnip
> hook (claude.md §16). This is the canonical first template (§4, §20). Format
> follows §16 exactly. Slots are written `{{ ... }}` and are filled from user
> input or the toy's `brand_config`.

---

## 1. Toy identity

- **Name:** Meme Booth
- **Template id:** `meme-booth`
- **One-liner:** Upload a selfie, get cooked into a personalised, on-brand meme
  you can't not share.
- **Emotion:** delighted surprise → "ha, that's *me*" → "I have to send this."
  The result is funny, flattering-enough, instantly recognisable as the user, and
  visibly tied to the brand.

## 2. User flow (exact public end-user steps)

1. **Land.** Brand logo, headline, and subhead from `brand_config`; one obvious
   call to action. Works standalone at `catnip.io/t/[slug]`, on a subdomain, on a
   verified custom domain, and embedded in a third-party iframe (§2, §4A).
2. **Consent.** A single explicit checkbox before any photo is processed, stating
   what happens to the image (§14). The CTA is disabled until it is ticked.
3. **Upload + name.** The user picks a photo (the self-insert) and optionally
   types a name/caption. A local preview is shown; the source photo never appears
   anywhere public.
4. **Bot check.** Cloudflare Turnstile runs before generation (§8).
5. **Generate.** The CTA submits. A branded loading state shows while the async
   job runs (§2.3) — the UI submits, then polls/subscribes for the result.
6. **Result.** The finished meme appears as a watermarked share card with brand
   attribution.
7. **Share.** Share buttons (X, WhatsApp, Instagram, copy link) post the card
   with UTM params. A clear CTA links back to the brand.
8. **Again / soft wall.** "Make another" until the per-visitor quota is reached,
   then a friendly soft wall with the brand CTA (§7).

Every off-happy-path step resolves to a branded graceful state, never an error
(§12) — see §8 below.

## 3. Generation contract

The **exact** prompt fed to the image model via `generateImage()` (never a direct
SDK call — hard rule #2). The user's photo is passed as the image input for
self-insert; text slots are interpolated, then the whole prompt is moderated
before it is sent.

### 3.1 Prompt template

```
SYSTEM / STYLE:
You are a meme illustrator. Transform the person in the SUPPLIED PHOTO into a
single, polished, shareable meme image. The person must remain clearly
recognisable as themselves (same face, hair, skin tone, distinguishing
features) — this is a self-insert, not a generic character.

SUBJECT (from user):
- Source face/photo: {{user.photo}}            // required, the self-insert
- Display name / caption: {{user.name | default: ""}}

SCENE (from template + brand):
- Concept: {{template.scene | default: "epic legendary trading-card hero portrait of the subject"}}
- Art style: {{brand.prompt_style | default: "bold, vibrant, playful internet-meme illustration, thick outlines, high contrast"}}
- Brand palette: primary {{brand.colors.primary}}, background {{brand.colors.background}}, accent {{brand.colors.accent | default: brand.colors.primary}}
- Brand motif (optional): subtly incorporate {{brand.motif | default: "none"}}; do NOT render the brand logo (Catnip composites the logo onto the share card).
- Mood: fun, flattering, energetic, safe-for-work.

COMPOSITION:
- One subject, centered, head-and-shoulders to waist-up, looking at camera.
- Leave a clear band at the {{template.caption_position | default: "bottom"}} for caption text.
- If a display name is provided, render it as bold meme caption text in that band:
  "{{user.name}}". If empty, render no caption text.

OUTPUT:
- Exactly one image.
- Aspect ratio {{template.aspect_ratio | default: "1:1"}}, {{template.resolution | default: "1024x1024"}}.
- No borders, no watermark (Catnip adds the watermark + attribution on the share card).

HARD CONSTRAINTS (do not violate):
- Keep it safe-for-work: no nudity, gore, violence, hate symbols, or drugs.
- Do not depict anyone who appears to be a minor.
- Do not generate real public figures or celebrities other than the supplied
  subject.
- Do not add text other than the provided caption.
- Preserve the subject's likeness; do not beautify beyond mild, natural flattery.
```

### 3.2 Slot reference

| Slot | Source | Required | Default |
|---|---|---|---|
| `{{user.photo}}` | uploaded image bytes | yes | — |
| `{{user.name}}` | name field | no | `""` (no caption) |
| `{{brand.prompt_style}}` | `brand_config.promptStyle` | no | bold playful meme illustration |
| `{{brand.colors.primary/background/accent}}` | `brand_config.colors` | no | platform defaults |
| `{{brand.motif}}` | `brand_config.motif` | no | `none` |
| `{{template.scene}}` | template/owner preset | no | legendary trading-card hero |
| `{{template.aspect_ratio}}` | template | no | `1:1` |
| `{{template.resolution}}` | template | no | `1024x1024` |
| `{{template.caption_position}}` | template | no | `bottom` |

### 3.3 Provider + cost

- Primary model: Google nano banana (Gemini image); fallback fal.ai/Imagen —
  same `ImageProvider` interface.
- The provider returns the EXACT `costUsd`; the run records `cost_usd` and
  `charged_usd = cost_usd * GENERATION_MARKUP` (§1, §11).

## 4. Share card spec (Vercel OG / satori)

The shareable artefact, generated server-side from the result (§9):

- **Canvas:** square, `1080x1080` (1:1), matching the generation aspect ratio.
- **Hero:** the generated meme, full-bleed.
- **Caption band:** the user's name/caption if present (already baked into the
  meme; the card may re-emphasise it in the brand font).
- **Brand attribution:** owner `logo` (top-left) + brand name, linking back to
  `brand_config.brandUrl`.
- **Watermark:** "Made with Catnip 🐈" bottom-right, small but legible. **On by
  default on launch tiers** (§9, hard rule #6) — it is the distribution engine.
- **Stored** in R2 behind a signed URL; referenced as `Run.shareCardUrl`. The
  raw provider URL is never exposed (§13).

## 5. Self-insert defaults

The subject **is** the user: their uploaded face is the centre of the meme, and
their name (optional) is the caption. Self-insert is on by default (§9). No photo
→ no run (the photo is required input).

## 6. Brand customisation surface (no code)

Everything the owner can change from the dashboard, stored in `Toy.brandConfig`:

| Field | What it controls |
|---|---|
| `logoUrl` | logo on the toy + share card |
| `brandName` | attribution text |
| `brandUrl` | where the CTA + attribution link |
| `colors.primary` / `.background` / `.text` / `.accent` | toy theme + prompt palette |
| `copy.headline` / `.subhead` / `.cta` / `.uploadLabel` / `.nameLabel` / `.consent` | all on-screen copy |
| `promptStyle` | the art style slot in the generation contract |
| `motif` (optional) | subtle brand motif in the scene |

Anything not set falls back to platform defaults so a toy is always renderable.
The owner cannot edit the prompt structure, the hooks, or the guardrails — those
are fixed by this template (our IP).

## 7. Required Catnip hooks (non-optional — §16.7)

The toy MUST call these, in order, on every generation:

1. **Per-visitor quota** — check/consume before reserving (`lib/metering` quota).
2. **Spend-cap reservation** — reserve → generate → reconcile; generation cannot
   start without a successful reserve, and the cap can never be exceeded under
   load (`lib/metering` spend cap, §7, hard rule #1). Also honours the kill
   switch and per-IP / per-toy rate limits.
3. **Input moderation** — `moderateImage()` on the photo (and `moderateText()` on
   the name) BEFORE generation, fail closed; reject NSFW, violence, and any
   apparent minor, and never store such images (§8).
4. **Generation job submission** — enqueue the durable job (QStash → the worker),
   then poll/subscribe for the result (§2.3).
5. **Output moderation** — `moderateImage()` on the result before it is shown or
   made shareable (§8).
6. **Share-card generation** — render the watermarked card (Vercel OG) and store
   it in R2 (§9).
7. **Analytics events** — emit `run` on completion, `share` on each share, and
   `return` for UTM landings (§10).

Plus consent capture and prompt source-photo deletion after generation (§14).

## 8. Guardrails

- **Moderation fail-closed** at input, prompt, and output (§8, hard rule #3); any
  apparent minor is rejected outright and never processed or stored.
- **Bot + rate-limit:** Turnstile before generation, per-IP and per-toy rate
  limits on top (§7, §13).
- **Spend cap is sacred:** if the reservation fails (cap reached or credits out),
  show the branded "taking a break" state — never an error, never an overspend.
- **Graceful states for everything** (`components/graceful-state`), one per
  failure path: `cap_reached`, `credits_out`, `quota_reached`, `rate_limited`,
  `moderation_rejected`, `generation_failed`, `provider_down`, `paused` /
  `not_available` (§12, hard rule #5).
- **Privacy:** explicit consent before processing; delete the source photo
  promptly after generation; results honour the retention window (§14).
- **Embed-safe:** renders inside third-party iframes; the generation key is never
  exposed — all generation runs server-side / in the worker (§13).
