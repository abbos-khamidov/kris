import { describe, expect, it } from "vitest";
import { formatPrice, pdfFileName, ageFromBirthDate, normalizeKey } from "../src/lib/format";
import { parseInline, stripInline } from "../src/pdf/inline";

const p = (kind: "fixed" | "range" | "from" | "approx" | "request" | "text", amount: number | null, max: number | null = null, text = "") => ({ kind, amount, max, text });
const NB = " ";

describe("price formats", () => {
  it("fixed", () => expect(formatPrice(p("fixed", 12500))).toBe(`12${NB}500${NB}₽`));
  it("range keeps every part joined by no-break spaces", () => {
    const s = formatPrice(p("range", 8500, 13000));
    expect(s).toBe(`8${NB}500${NB}–${NB}13${NB}000${NB}₽`);
    expect(s).not.toMatch(/ /); // no ordinary space = no wrap opportunity inside a price
  });
  it("from / approx / request / text", () => {
    expect(formatPrice(p("from", 9000))).toBe(`от${NB}9${NB}000${NB}₽`);
    expect(formatPrice(p("approx", 25000))).toBe(`~25${NB}000${NB}₽`);
    expect(formatPrice(p("request", null))).toBe("по запросу");
    expect(formatPrice(p("text", null, null, "аптека"))).toBe("аптека");
  });
  it("empty amount renders nothing", () => expect(formatPrice(p("fixed", null))).toBe(""));
});

describe("helpers", () => {
  it("file name", () => {
    expect(pdfFileName("Иванова Мария: А/Б", new Date("2026-11-25T10:00:00Z"))).toBe("Карта_пациента_Иванова_Мария_АБ_2026-11-25.pdf");
  });
  it("age", () => {
    expect(ageFromBirthDate("1990-06-15", new Date("2026-06-14"))).toBe(35);
    expect(ageFromBirthDate("1990-06-15", new Date("2026-06-15"))).toBe(36);
    expect(ageFromBirthDate("not a date")).toBeNull();
  });
  it("normalizeKey ignores case, ё and punctuation", () => {
    expect(normalizeKey("Крем,  ЁЖИК!")).toBe(normalizeKey("крем ежик"));
  });
});

describe("inline markup", () => {
  it("parses bold / accent / warning", () => {
    expect(parseInline("a **b** ==c== !!d!!")).toEqual([
      { text: "a ", style: "normal" },
      { text: "b", style: "bold" },
      { text: " ", style: "normal" },
      { text: "c", style: "accent" },
      { text: " ", style: "normal" },
      { text: "d", style: "warn" },
    ]);
  });
  it("keeps unclosed markers as text so nothing typed is lost", () => {
    expect(stripInline("цена **не закрыта")).toBe("цена **не закрыта");
    expect(stripInline("5 ** 3")).toBe("5 ** 3");
  });
});
