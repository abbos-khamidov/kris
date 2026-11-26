/**
 * PDF design system. FIXED and independent of the website theme, screen, orientation or dark mode
 * (ADR-013). Values are measured from the reference PDFs in references/ (595x822 pt pages).
 * Never import anything from the site theme into src/pdf — a test enforces this.
 */
export const PAGE = { w: 595, h: 822 } as const;

export const COLOR = {
  burgundy: "#800B0F",
  milk: "#F2EDEA",
  white: "#FFFFFF",
  text: "#000000",
  textSoft: "#4A4A4A",
  muted: "#8C8580",
  line: "#D9D2CC",
  green: "#6AB54A",
  red: "#D93A3A",
  warn: "#C0392B",
  shadow: "#000000",
  overlay: "#000000",
} as const;

export const FONT = { serif: "Prata", sans: "Manrope" } as const;

export const SIZE = {
  coverTitle: 63,
  coverName: 44,
  pageTitle: 30,
  body: 15,
  small: 11,
  label: 15,
  heading: 18,
  button: 24,
  sideText: 9,
} as const;

/** Unified geometry (the references vary by a few points between pages; here it is consistent). */
export const GEO = {
  marginX: 30,
  titleTop: 44,
  cardTop: 100,
  cardBottom: 36,
  cardRadius: 36,
  cardPadX: 24,
  cardPadTop: 26,
  cardPadBottom: 26,
  rowRadius: 20,
  rowGap: 10,
} as const;

/** Auto-fit steps for long text (src/pdf/fit.tsx), from full size down to the smallest. */
export const FIT_STEPS = [1, 0.93, 0.86, 0.8, 0.74, 0.68] as const;
/** Smallest type auto-fit may produce, in points (text that is already smaller keeps its size). */
export const MIN_TYPE = 9;
export const fitSize = (size: number, k = 1) => Math.max(Math.min(size, MIN_TYPE), Math.round(size * k * 10) / 10);

/** A block taller than a page must be allowed to break, otherwise its end would be cut off. */
export const keepTogether = (...texts: string[]) => texts.join("").length < 600;

export const BRAND_SLOTS = [
  "cover",
  "bg_products",
  "bg_room",
  "face_illustration",
  "side_actives_top",
  "side_actives_bottom",
  "side_nutrition",
  "side_vitamins",
  "specialist",
] as const;
export type BrandSlot = (typeof BRAND_SLOTS)[number];
