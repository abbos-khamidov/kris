import type { Price } from "./schemas/common";

const NBSP = " ";
/** 12500 -> "12 500" with no-break spaces so a price never wraps mid-number. */
export function formatAmount(n: number): string {
  const s = Math.round(n).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** Single place where prices become text — used by the UI and the PDF alike. */
export function formatPrice(p: Price | null | undefined): string {
  if (!p) return "";
  const rub = `${NBSP}₽`;
  switch (p.kind) {
    case "request":
      return "по запросу";
    case "text":
      return p.text.trim();
    case "range":
      if (p.amount == null) return "";
      return p.max != null ? `${formatAmount(p.amount)}${NBSP}–${NBSP}${formatAmount(p.max)}${rub}` : `${formatAmount(p.amount)}${rub}`;
    case "from":
      return p.amount == null ? "" : `от${NBSP}${formatAmount(p.amount)}${rub}`;
    case "approx":
      return p.amount == null ? "" : `~${formatAmount(p.amount)}${rub}`;
    case "fixed":
    default:
      return p.amount == null ? "" : `${formatAmount(p.amount)}${rub}`;
  }
}

export function ageFromBirthDate(birth: string | null | undefined, now = new Date()): number | null {
  if (!birth) return null;
  const d = new Date(birth);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

export function pluralYears(n: number): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return "лет";
  if (b > 1 && b < 5) return "года";
  if (b === 1) return "год";
  return "лет";
}

export function formatDateRu(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "Карта_пациента_Иванова_Мария_2026-11-25.pdf" — safe on every OS. */
export function pdfFileName(fullName: string, date = new Date()): string {
  const safe = fullName
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 80);
  return `Карта_пациента_${safe || "без_имени"}_${date.toISOString().slice(0, 10)}.pdf`;
}

/** Normalised key used to detect duplicate text blocks / products. */
export function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
