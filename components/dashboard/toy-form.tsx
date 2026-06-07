import type { BrandConfig } from "@/lib/toy/brand";

/**
 * Toy create/edit form (claude.md §4B). A plain server-rendered <form> posting to
 * a server action, so a non-technical owner can complete it with no JS required.
 * Used by onboarding (createToy) and editing (updateToy).
 */
export function ToyForm({
  action,
  submitLabel,
  name,
  brand,
  perVisitorQuota,
  spendCapUsd,
  toyId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  name: string;
  brand: BrandConfig;
  perVisitorQuota: number;
  spendCapUsd: number;
  toyId?: string;
}) {
  return (
    <form action={action} className="space-y-8">
      {toyId ? <input type="hidden" name="toyId" value={toyId} /> : null}

      <Section title="Basics">
        <Field label="Toy name">
          <input
            name="name"
            defaultValue={name}
            required
            placeholder="Acme Meme Booth"
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Copy">
        <Field label="Headline">
          <input name="copyHeadline" defaultValue={brand.copy.headline} className={inputClass} />
        </Field>
        <Field label="Subhead">
          <input name="copySubhead" defaultValue={brand.copy.subhead} className={inputClass} />
        </Field>
        <Field label="Button text">
          <input name="copyCta" defaultValue={brand.copy.cta} className={inputClass} />
        </Field>
      </Section>

      <Section title="Brand">
        <Field label="Brand name (attribution)">
          <input name="brandName" defaultValue={brand.brandName ?? ""} className={inputClass} />
        </Field>
        <Field label="Brand link (where the CTA points)">
          <input name="brandUrl" type="url" defaultValue={brand.brandUrl ?? ""} placeholder="https://yourbrand.com" className={inputClass} />
        </Field>
        <Field label="Logo URL">
          <input name="logoUrl" type="url" defaultValue={brand.logoUrl ?? ""} placeholder="https://…/logo.png" className={inputClass} />
        </Field>
        <Field label="Prompt style">
          <input name="promptStyle" defaultValue={brand.promptStyle} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ColorField label="Primary" name="colorPrimary" value={brand.colors.primary} />
          <ColorField label="Background" name="colorBackground" value={brand.colors.background} />
          <ColorField label="Text" name="colorText" value={brand.colors.text} />
          <ColorField label="Accent" name="colorAccent" value={brand.colors.accent} />
        </div>
      </Section>

      <Section title="Limits — no surprise bills">
        <Field label="Free runs per visitor">
          <input
            name="perVisitorQuota"
            type="number"
            min={1}
            step={1}
            defaultValue={perVisitorQuota}
            className={inputClass}
          />
        </Field>
        <Field label="Hard spend cap (USD) — generation stops at this, always">
          <input
            name="spendCapUsd"
            type="number"
            min={0}
            step="0.01"
            defaultValue={spendCapUsd}
            className={inputClass}
          />
        </Field>
      </Section>

      <button
        type="submit"
        className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white"
      >
        {submitLabel}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}

function ColorField({ label, name, value }: { label: string; name: string; value: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-neutral-600">{label}</span>
      <input
        name={name}
        type="color"
        defaultValue={value}
        className="h-10 w-full rounded-lg border border-neutral-300"
      />
    </label>
  );
}
