import { normalizeKey } from "@/lib/format";

/**
 * Reference-card parser. Works on positioned text items (from pdf.js, or synthetic data in tests),
 * recognises the ten standard sections and returns a STRUCTURED DRAFT for the specialist to review.
 * It never decides anything medical: every candidate starts unaccepted (ADR-008).
 */
export interface TextItem {
  str: string;
  x: number;
  /** BASELINE, in points from the page top (items on one text line share it) */
  y: number;
  size: number;
}
export interface PageItems {
  items: TextItem[];
}

export type SectionKey = "personal" | "skin" | "care" | "actives" | "nutrition" | "vitamins" | "products" | "procedures" | "conclusion";

const TITLES: [RegExp, SectionKey][] = [
  [/ЛИЧНЫЕ\s+ДАННЫЕ/, "personal"],
  [/СОСТОЯНИЕ\s+КОЖИ/, "skin"],
  [/СХЕМА\s+УХОДА/, "care"],
  [/АКТИВЫ/, "actives"],
  [/ПИТАНИЕ/, "nutrition"],
  [/ВИТАМИНЫ/, "vitamins"],
  [/РЕКОМЕНДОВАННЫЕ\s+СРЕДСТВА/, "products"],
  [/ПЛАН\s+ПРОЦЕДУР/, "procedures"],
  [/ЗАКЛЮЧЕНИЕ/, "conclusion"],
];
const ORDER: (SectionKey | "cover")[] = ["cover", "personal", "skin", "care", "actives", "nutrition", "vitamins", "products", "procedures", "conclusion"];

export interface ParsedProduct {
  name: string;
  price: string;
  isAlternative: boolean;
}
export interface ParsedProcedure {
  name: string;
  price: string;
  isAlternative: boolean;
}
export interface ParsedCard {
  pages: number;
  /** Personal data of the patient in the source document. Kept ONLY in the import record. */
  patient: { fullName: string; lines: string[] };
  sections: Partial<Record<Exclude<SectionKey, "personal" | "products" | "procedures">, string[]>>;
  products: ParsedProduct[];
  procedures: ParsedProcedure[];
  /** Pages whose section could not be recognised (reported, never guessed). */
  unrecognised: number[];
}

type Line = { y: number; size: number; items: TextItem[]; text: string };

const isNoise = (s: string) => /^\s*@/.test(s) || !s.trim();

function toLines(items: TextItem[]): Line[] {
  const sorted = [...items].filter((i) => !isNoise(i.str)).sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: Line[] = [];
  for (const it of sorted) {
    const last = lines.at(-1);
    if (last && Math.abs(last.y - it.y) <= 4) {
      last.items.push(it);
      last.size = Math.max(last.size, it.size);
    } else lines.push({ y: it.y, size: it.size, items: [it], text: "" });
  }
  for (const l of lines) {
    l.items.sort((a, b) => a.x - b.x);
    l.text = l.items.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
  }
  return lines;
}

function classify(page: PageItems, index: number, total: number): SectionKey | "cover" | null {
  const big = page.items.filter((i) => i.size >= 26).map((i) => i.str).join(" ").toUpperCase();
  if (index === 0 && /КАРТА|ПАЦИЕНТА/.test(big)) return "cover";
  for (const [re, key] of TITLES) if (re.test(big)) return key;
  // Fallback: the standard card has exactly ten pages in a fixed order.
  return total === 10 ? ORDER[index] : null;
}

/** Splits lines into paragraphs by vertical gaps; title lines are dropped. */
function paragraphs(lines: Line[], titleSize: number): string[] {
  const body = lines.filter((l) => l.size < titleSize - 1);
  const out: string[] = [];
  let cur: string[] = [];
  let prev: Line | null = null;
  for (const l of body) {
    if (prev && l.y - prev.y > Math.max(prev.size, l.size) * 1.65) {
      if (cur.length) out.push(cur.join(" "));
      cur = [];
    }
    cur.push(l.text);
    prev = l;
  }
  if (cur.length) out.push(cur.join(" "));
  return out.map((p) => p.replace(/\s+/g, " ").trim()).filter((p) => p.length >= 3);
}

const PRICE = /(\d[\d\s]*[\d](?:\s*[-–/]\s*\d[\d\s]*\d)?)\s*(?:₽|р\.?|руб\.?|т\b|тыс)?/i;
const hasPrice = (s: string) => /\d/.test(s) && /(₽|р\b|р\.|руб|т\b|тыс|\d{3,})/i.test(s);

function cleanName(s: string): { name: string; alt: boolean } {
  let t = s.replace(/^\s*\d+\s*[.)]\s*/, "").trim();
  const alt = /^или\s+/i.test(t);
  t = t.replace(/^или\s+/i, "").trim();
  return { name: t, alt };
}

function parseProducts(lines: Line[]): ParsedProduct[] {
  const rows: { left: string[]; price: string[] }[] = [];
  for (const l of lines) {
    if (l.size >= 26) continue; // title
    const left = l.items.filter((i) => i.x < 440).map((i) => i.str).join(" ").trim();
    const right = l.items.filter((i) => i.x >= 440).map((i) => i.str).join(" ").trim();
    if (/^\s*\*/.test(left) || /^(Все средства|на официальных|и сторонних)/i.test(left)) continue; // footnote
    const starts = /^\s*\d+\s*[.)]/.test(left);
    if (starts || rows.length === 0) rows.push({ left: [], price: [] });
    const row = rows.at(-1)!;
    if (left) row.left.push(left);
    if (right) row.price.push(right);
  }
  const out: ParsedProduct[] = [];
  for (const r of rows) {
    const text = r.left.join(" ").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const { name, alt } = cleanName(text.replace(/\s*(очищение|тоники?|сыворотки?|кремы?)\s*:\s*$/i, "").replace(/^(\d+\s*[.)]\s*)?(очищение|тоники?)\s*:\s*/i, "$1"));
    const priceText = r.price.join(" ").replace(/\s+/g, " ").trim();
    if (name.length >= 3) out.push({ name, price: priceText, isAlternative: alt });
  }
  return out;
}

/**
 * Procedure rows: the row number is vertically CENTRED in its cell, so text lines do not share a line with
 * it. Every item is assigned to the row whose number is nearest, using midpoints between numbers as borders.
 */
function parseProcedures(lines: Line[]): ParsedProcedure[] {
  const items = lines.filter((l) => l.size < 26).flatMap((l) => l.items);
  const centre = (i: TextItem) => i.y - i.size * 0.35;
  const markers = items.filter((i) => i.x < 135 && /^\d{1,2}$/.test(i.str.trim())).sort((p, q) => centre(p) - centre(q));
  if (markers.length === 0) return [];
  const borders = markers.slice(1).map((m, k) => (centre(markers[k]) + centre(m)) / 2);
  const rows = markers.map(() => ({ text: [] as TextItem[], price: [] as TextItem[] }));
  for (const it of items) {
    if (it.x < 135) continue;
    const row = borders.findIndex((bd) => centre(it) < bd);
    const idx = row === -1 ? markers.length - 1 : row;
    (it.x >= 450 ? rows[idx].price : rows[idx].text).push(it);
  }
  const join = (list: TextItem[]) =>
    [...list]
      .sort((p, q) => p.y - q.y || p.x - q.x)
      .map((i) => i.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  return rows
    .map((row) => {
      const { name, alt } = cleanName(join(row.text));
      return { name, price: join(row.price), isAlternative: alt };
    })
    .filter((p) => p.name.length >= 3);
}

export function parseCard(pages: PageItems[]): ParsedCard {
  const result: ParsedCard = {
    pages: pages.length,
    patient: { fullName: "", lines: [] },
    sections: {},
    products: [],
    procedures: [],
    unrecognised: [],
  };
  pages.forEach((page, i) => {
    const kind = classify(page, i, pages.length);
    if (kind === null) {
      result.unrecognised.push(i + 1);
      return;
    }
    if (kind === "cover") return; // contains only the title and the patient name
    const lines = toLines(page.items);
    if (kind === "personal") {
      result.patient.lines = lines.filter((l) => l.size < 26).map((l) => l.text);
      const fio = result.patient.lines.find((t) => /^ФИО\s*:/i.test(t));
      result.patient.fullName = fio ? fio.replace(/^ФИО\s*:\s*/i, "").trim() : "";
    } else if (kind === "products") result.products.push(...parseProducts(lines));
    else if (kind === "procedures") result.procedures.push(...parseProcedures(lines));
    else {
      const key = kind as keyof ParsedCard["sections"];
      result.sections[key] = [...(result.sections[key] ?? []), ...paragraphs(lines, 26)];
    }
  });
  return result;
}

/** Stable key for duplicate detection (case, ё and punctuation insensitive). */
export const candidateKey = (kind: string, text: string) => `${kind}:${normalizeKey(text)}`;

/** Best-effort number from a price string: "4500 ₽" -> 4500; ranges/odd text -> null. */
export function priceAmount(s: string): number | null {
  const m = PRICE.exec(s.replace(/ /g, " "));
  if (!m || /[-–/]/.test(m[1])) return null;
  const n = Number(m[1].replace(/\s/g, ""));
  return Number.isFinite(n) && n > 0 && hasPrice(s) ? n : null;
}
