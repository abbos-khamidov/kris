import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PALETTES, buildTheme, contrast, ensureContrast, isHex, resolveDark, type PaletteId } from "../src/lib/theme";

const BG_LIGHT = "#F5F1ED";
const WHITE = "#FFFFFF";
const SURFACE_DARK = "#262220";
const pal = (palette: PaletteId, custom = "#791F2B") => buildTheme({ palette, custom, mode: "light" });

describe("theme contrast (WCAG AA)", () => {
  it("every preset is readable as text/controls on the page background and on white", () => {
    for (const id of Object.keys(PALETTES) as (keyof typeof PALETTES)[]) {
      const t = pal(id);
      expect(contrast(t.effective.light, BG_LIGHT), `${id} on page`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.effective.light, WHITE), `${id} on white`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.light["--primary"], t.light["--primary-foreground"]), `${id} button text`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("dark mode lightens the colour until it is readable on the dark surface", () => {
    for (const id of Object.keys(PALETTES) as (keyof typeof PALETTES)[]) {
      const t = pal(id);
      expect(contrast(t.effective.dark, SURFACE_DARK), `${id} on dark`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.dark["--primary"], t.dark["--primary-foreground"]), `${id} dark button text`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the default Burgundy keeps the original brand colour untouched", () => {
    const t = pal("burgundy");
    expect(t.light["--primary"].toLowerCase()).toBe("#791f2b");
    expect(t.adjusted).toBe(true); // only because dark mode needs a lighter variant
    expect(t.effective.light.toLowerCase()).toBe("#791f2b");
  });

  it("a hard custom colour (light yellow) is darkened, never left unreadable", () => {
    const t = pal("custom", "#FFFF99");
    expect(t.adjusted).toBe(true);
    expect(contrast(t.effective.light, BG_LIGHT)).toBeGreaterThanOrEqual(4.5);
  });

  it("an invalid custom value falls back to the default instead of breaking the UI", () => {
    expect(pal("custom", "not-a-colour").light["--primary"].toLowerCase()).toBe("#791f2b");
    expect(isHex("#12ab9F")).toBe(true);
    expect(isHex("#12ab9")).toBe(false);
  });

  it("ensureContrast leaves an already-readable colour alone", () => {
    expect(ensureContrast("#000000", WHITE)).toEqual({ hex: "#000000", adjusted: false });
  });

  it("system mode follows the OS", () => {
    expect(resolveDark("system", true)).toBe(true);
    expect(resolveDark("system", false)).toBe(false);
    expect(resolveDark("light", true)).toBe(false);
    expect(resolveDark("dark", false)).toBe(true);
  });
});

describe("PDF is isolated from the website theme", () => {
  it("nothing under src/pdf imports the theme or reads CSS variables", () => {
    const dir = path.resolve("src/pdf");
    for (const f of fs.readdirSync(dir)) {
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      expect(src, f).not.toMatch(/lib\/theme|theme-provider|prefers-color-scheme|var\(--/);
    }
  });
});
