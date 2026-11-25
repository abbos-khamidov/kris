/**
 * Website theme only. The PDF has its own FIXED design system (src/pdf/tokens.ts) and must never import
 * this file — a test enforces it (ADR-013).
 */
export const PALETTES = {
  burgundy: { label: "Burgundy", hex: "#791F2B" },
  sage: { label: "Sage", hex: "#657A62" },
  mocha: { label: "Mocha", hex: "#795548" },
  rose: { label: "Dusty Rose", hex: "#AC747E" },
  graphite: { label: "Graphite", hex: "#343434" },
  navy: { label: "Navy", hex: "#304760" },
} as const;
export type PaletteId = keyof typeof PALETTES | "custom";
export type ThemeMode = "light" | "dark" | "system";

export interface ThemePrefs {
  palette: PaletteId;
  custom: string;
  mode: ThemeMode;
}
export const DEFAULT_PREFS: ThemePrefs = { palette: "burgundy", custom: "#791F2B", mode: "light" };

/* ---------------------------------------------------------------- colour maths */

export const isHex = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s);

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (c: [number, number, number]) =>
  `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;

export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1..21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function mix(a: string, b: string, t: number): string {
  const [x, y] = [rgb(a), rgb(b)];
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/** Moves a colour towards black/white (in small steps) until it reaches `min` contrast on `bg`. */
export function ensureContrast(hex: string, bg: string, min = 4.5, toward: "black" | "white" = "black"): { hex: string; adjusted: boolean } {
  let c = hex;
  for (let i = 0; i < 40 && contrast(c, bg) < min; i++) c = mix(c, toward === "black" ? "#000000" : "#ffffff", 0.06);
  return { hex: c, adjusted: c !== hex };
}

/* ---------------------------------------------------------------- tokens */

const LIGHT = { background: "#F5F1ED", surface: "#FFFFFF", foreground: "#292524", muted: "#8C8580", mutedText: "#6B645F", border: "#E4DBD2", input: "#DCD1C6", secondary: "#ECE5DE" };
const DARK = { background: "#1C1917", surface: "#262220", foreground: "#F5F1ED", muted: "#A8A29E", mutedText: "#B5AEA8", border: "#3A3431", input: "#4A423D", secondary: "#2E2926" };

export type Tokens = Record<string, string>;
export interface BuiltTheme {
  light: Tokens;
  dark: Tokens;
  /** The chosen colour had to be adjusted to stay readable (WCAG AA). */
  adjusted: boolean;
  effective: { light: string; dark: string };
}

const pick = (bg: string) => (contrast("#FFFFFF", bg) >= contrast("#1C1917", bg) ? "#FFFFFF" : "#1C1917");

function tokensFor(primary: string, p: typeof LIGHT, dark: boolean): Tokens {
  const fg = pick(primary);
  const tint = mix(primary, p.surface, dark ? 0.82 : 0.9);
  return {
    "--background": p.background,
    "--foreground": p.foreground,
    "--surface": p.surface,
    "--card": p.surface,
    "--card-foreground": p.foreground,
    "--popover": p.surface,
    "--popover-foreground": p.foreground,
    "--primary": primary,
    "--primary-foreground": fg,
    "--secondary": p.secondary,
    "--secondary-foreground": p.foreground,
    "--muted": p.secondary,
    "--muted-foreground": p.mutedText,
    "--accent": tint,
    "--accent-foreground": dark ? p.foreground : primary,
    "--border": p.border,
    "--input": p.input,
    "--ring": mix(primary, p.background, 0.25),
    "--sidebar": p.surface,
    "--sidebar-foreground": p.foreground,
    "--sidebar-primary": primary,
    "--sidebar-primary-foreground": fg,
    "--sidebar-accent": tint,
    "--sidebar-accent-foreground": dark ? p.foreground : primary,
    "--sidebar-border": p.border,
    "--sidebar-ring": mix(primary, p.background, 0.25),
    "--destructive": dark ? "#F97066" : "#B42318",
  };
}

export function buildTheme(prefs: ThemePrefs): BuiltTheme {
  const base = prefs.palette === "custom" ? (isHex(prefs.custom) ? prefs.custom.toUpperCase() : PALETTES.burgundy.hex) : PALETTES[prefs.palette].hex;
  // Text/controls drawn in the primary colour must be readable on the page background AND on white.
  const l1 = ensureContrast(base, LIGHT.background, 4.5, "black");
  const l2 = ensureContrast(l1.hex, LIGHT.surface, 4.5, "black");
  // In dark mode the colour is lightened until it is readable on the dark surface.
  const d = ensureContrast(base, DARK.surface, 4.5, "white");
  return {
    light: tokensFor(l2.hex, LIGHT, false),
    dark: tokensFor(d.hex, DARK, true),
    adjusted: l2.hex.toLowerCase() !== base.toLowerCase() || d.adjusted,
    effective: { light: l2.hex, dark: d.hex },
  };
}

export const STORAGE_KEY = "kris.ui.v1";

export function resolveDark(mode: ThemeMode, systemDark: boolean) {
  return mode === "dark" || (mode === "system" && systemDark);
}

/** Inline script run before first paint: applies the cached theme so there is no flash of the wrong colours. */
export const ANTI_FLASH = `(function(){try{var s=JSON.parse(localStorage.getItem("${STORAGE_KEY}")||"null");if(!s)return;var m=s.prefs&&s.prefs.mode;var d=m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var t=d?s.dark:s.light;var r=document.documentElement;for(var k in t)r.style.setProperty(k,t[k]);r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light"}catch(e){}})()`;
