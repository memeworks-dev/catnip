import { appConfig } from "@/lib/env";

/** Public link to a toy (claude.md §4B). */
export function toyUrl(slug: string): string {
  return `${appConfig.appUrl}/t/${slug}`;
}

/** Embeddable iframe snippet for a toy (§4B, §13 — toys render in iframes). */
export function embedSnippet(slug: string): string {
  return `<iframe src="${toyUrl(slug)}" width="420" height="720" style="border:0;border-radius:16px;max-width:100%" allow="camera" loading="lazy" title="Catnip toy"></iframe>`;
}
