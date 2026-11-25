import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("service worker never caches medical data", () => {
  const sw = fs.readFileSync("public/sw.js", "utf8");
  const match = /const STATIC = (\/.*\/);/.exec(sw);
  const STATIC = match ? new RegExp(match[1].slice(1, -1)) : /$^/;

  it("only static asset folders are cacheable", () => {
    for (const ok of ["/_next/static/chunks/a.js", "/fonts/Prata_400Regular.ttf", "/icons/icon-192.png"]) expect(STATIC.test(ok), ok).toBe(true);
  });
  it("pages, API, files, storage and PDFs are never cached", () => {
    for (const no of ["/", "/patients", "/patients/123?tab=photos", "/cards/1", "/api/files/token", "/storage/v1/object/sign/kris-private/x.pdf", "/documents/a.pdf", "/pdf.worker.min.mjs"]) {
      expect(STATIC.test(no), no).toBe(false);
    }
  });
  it("ignores non-GET and cross-origin requests", () => {
    expect(sw).toMatch(/req\.method !== "GET"\) return/);
    expect(sw).toMatch(/url\.origin !== self\.location\.origin/);
  });
});
