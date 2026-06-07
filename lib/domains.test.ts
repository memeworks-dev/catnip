import { describe, expect, it } from "vitest";
import {
  normalizeDomain,
  isValidDomain,
  isPlatformDomain,
  serializeRecords,
  parseRecords,
  type DnsRecord,
} from "@/lib/domains";

/**
 * Custom-domain input handling + DNS-record persistence (claude.md §2A). Pure
 * helpers, no Vercel/DB calls.
 */
describe("normalizeDomain (§2A)", () => {
  it("strips protocol, path, wildcard, trailing dot, and lower-cases", () => {
    expect(normalizeDomain("https://Meme.Brand.com/path?x=1")).toBe("meme.brand.com");
    expect(normalizeDomain("  *.meme.brand.com.  ")).toBe("meme.brand.com");
    expect(normalizeDomain("MEME.BRAND.COM")).toBe("meme.brand.com");
  });
});

describe("isValidDomain (§2A)", () => {
  it("accepts real domains", () => {
    expect(isValidDomain("meme.brand.com")).toBe(true);
    expect(isValidDomain("brand.com")).toBe(true);
    expect(isValidDomain("a.b.c.brand.co.uk")).toBe(true);
  });

  it("rejects junk", () => {
    expect(isValidDomain("not a domain")).toBe(false);
    expect(isValidDomain("brand")).toBe(false);
    expect(isValidDomain("http://brand.com")).toBe(false);
    expect(isValidDomain("")).toBe(false);
  });
});

describe("isPlatformDomain (§2A)", () => {
  it("rejects Catnip-owned hosts", () => {
    expect(isPlatformDomain("catnip.io", "catnip.io")).toBe(true);
    expect(isPlatformDomain("cool.catnip.io", "catnip.io")).toBe(true);
    expect(isPlatformDomain("anything.vercel.app", "catnip.io")).toBe(true);
  });

  it("allows a genuine third-party domain", () => {
    expect(isPlatformDomain("meme.brand.com", "catnip.io")).toBe(false);
  });
});

describe("DNS record persistence (§2A)", () => {
  it("round-trips records through the domainDnsTarget column", () => {
    const records: DnsRecord[] = [
      { type: "CNAME", name: "meme", value: "cname.vercel-dns.com" },
      { type: "A", name: "@", value: "76.76.21.21" },
    ];
    expect(parseRecords(serializeRecords(records))).toEqual(records);
  });

  it("returns [] for empty/null and tolerates a legacy plain target", () => {
    expect(parseRecords(null)).toEqual([]);
    expect(parseRecords("")).toEqual([]);
    expect(parseRecords("cname.vercel-dns.com")).toEqual([
      { type: "CNAME", name: "@", value: "cname.vercel-dns.com" },
    ]);
  });
});
