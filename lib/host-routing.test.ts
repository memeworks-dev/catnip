import { describe, expect, it } from "vitest";
import { classifyHost, routeKeyForHost, normalizeHost } from "@/lib/host-routing";

/**
 * Host-based routing rules (claude.md §2A). Pure + edge-safe, so unit-testable
 * without a DB. An explicit rootDomain keeps these independent of ROOT_DOMAIN.
 */
const ROOT = "catnip.io";

describe("classifyHost (§2A)", () => {
  it("treats the apex and www as the app", () => {
    expect(classifyHost("catnip.io", ROOT)).toEqual({ kind: "app" });
    expect(classifyHost("www.catnip.io", ROOT)).toEqual({ kind: "app" });
  });

  it("treats Vercel + local hosts as the app", () => {
    expect(classifyHost("catnip-abc123.vercel.app", ROOT)).toEqual({ kind: "app" });
    expect(classifyHost("localhost", ROOT)).toEqual({ kind: "app" });
    expect(classifyHost("127.0.0.1", ROOT)).toEqual({ kind: "app" });
  });

  it("maps a single-label subdomain to a toy slug", () => {
    expect(classifyHost("cool-toy.catnip.io", ROOT)).toEqual({
      kind: "subdomain",
      slug: "cool-toy",
    });
  });

  it("strips the port and lower-cases", () => {
    expect(classifyHost("Cool-Toy.Catnip.io:3000", ROOT)).toEqual({
      kind: "subdomain",
      slug: "cool-toy",
    });
  });

  it("keeps reserved subdomains on the app", () => {
    expect(classifyHost("www.catnip.io", ROOT)).toEqual({ kind: "app" });
    expect(classifyHost("api.catnip.io", ROOT)).toEqual({ kind: "app" });
    expect(classifyHost("dashboard.catnip.io", ROOT)).toEqual({ kind: "app" });
  });

  it("does not treat a multi-label subdomain as a toy", () => {
    expect(classifyHost("a.b.catnip.io", ROOT)).toEqual({ kind: "app" });
  });

  it("treats any other host as a candidate custom domain", () => {
    expect(classifyHost("meme.theirbrand.com", ROOT)).toEqual({
      kind: "custom",
      host: "meme.theirbrand.com",
    });
    expect(classifyHost("theirbrand.com", ROOT)).toEqual({
      kind: "custom",
      host: "theirbrand.com",
    });
  });

  it("falls back to the app when the host is missing", () => {
    expect(classifyHost(null, ROOT)).toEqual({ kind: "app" });
    expect(classifyHost("", ROOT)).toEqual({ kind: "app" });
  });
});

describe("routeKeyForHost (§2A)", () => {
  it("returns the slug for a subdomain (no dot) and the host for a custom domain", () => {
    expect(routeKeyForHost({ kind: "subdomain", slug: "cool" })).toBe("cool");
    expect(routeKeyForHost({ kind: "custom", host: "meme.brand.com" })).toBe(
      "meme.brand.com",
    );
    expect(routeKeyForHost({ kind: "app" })).toBeNull();
  });

  it("produces a dotted key only for custom domains (so the page can disambiguate)", () => {
    const sub = routeKeyForHost({ kind: "subdomain", slug: "cool" });
    const custom = routeKeyForHost({ kind: "custom", host: "meme.brand.com" });
    expect(sub?.includes(".")).toBe(false);
    expect(custom?.includes(".")).toBe(true);
  });
});

describe("normalizeHost", () => {
  it("lower-cases and strips the port", () => {
    expect(normalizeHost("Meme.Brand.COM:443")).toBe("meme.brand.com");
    expect(normalizeHost(null)).toBeNull();
  });
});
