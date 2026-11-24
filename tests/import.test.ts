import { describe, expect, it } from "vitest";
import { candidateKey, parseCard, priceAmount, type PageItems, type TextItem } from "../src/lib/import/parse";

// Synthetic, fictional pages that mimic the reference layout. y = BASELINE in points from the page top.
const t = (str: string, x: number, y: number, size = 15): TextItem => ({ str, x, y, size });
const title = (s: string): TextItem => t(s, 31, 70, 30);
const blank: PageItems = { items: [] };

const cover: PageItems = { items: [t("КАРТА", 69, 18, 63), t("ПАЦИЕНТА", 69, 94, 63), t("Вымышленная Тест", 69, 737, 44)] };
const personal: PageItems = {
  items: [title("ЛИЧНЫЕ ДАННЫЕ"), t("ФИО:", 58, 165), t("Вымышленная Тест", 97, 165, 25), t("Возраст: 30 лет", 58, 217), t("@test_side", 9, 100, 9)],
};
const skin: PageItems = {
  items: [title("СОСТОЯНИЕ КОЖИ"), t("Первый абзац тестового текста", 31, 90, 16), t("продолжение первого абзаца", 31, 108, 16), t("Второй абзац после паузы", 31, 150, 16)],
};
const products: PageItems = {
  items: [
    title("РЕКОМЕНДОВАННЫЕ СРЕДСТВА"),
    t("1. очищение:", 53, 118, 16),
    t("тестовый гель альфа", 56, 137, 14),
    t("1 800 ₽", 484, 135, 16),
    t("2. или тестовая пенка бета", 53, 185, 16),
    t("2450p", 487, 185, 16),
    t("3.тестовый крем", 53, 235, 16),
    t("аптека ₽", 477, 235, 16),
    t("*Все средства по выгодным ценам", 53, 721, 11),
  ],
};
const procedures: PageItems = {
  items: [
    title("ПЛАН ПРОЦЕДУР"),
    t("1", 78, 123, 16),
    t("тестовая процедура один", 159, 114),
    t("курс из трёх сеансов", 159, 132),
    t("9 000 ₽", 480, 123, 15),
    t("2", 77, 188, 16),
    t("или тестовая процедура два", 159, 179),
    t("от 8 500 ₽", 480, 188, 15),
  ],
};

const full = (): PageItems[] => [cover, personal, skin, blank, blank, blank, blank, products, procedures, blank];

describe("reference card parser", () => {
  const r = parseCard(full());

  it("separates the patient's personal data from the recommendations", () => {
    expect(r.patient.fullName).toBe("Вымышленная Тест");
    expect(r.patient.lines.join(" ")).toContain("Возраст");
    const everythingElse = JSON.stringify({ s: r.sections, p: r.products, pr: r.procedures });
    expect(everythingElse).not.toContain("Вымышленная");
    expect(everythingElse).not.toContain("Возраст");
  });

  it("drops side captions and keeps paragraphs apart", () => {
    expect(r.sections.skin).toEqual(["Первый абзац тестового текста продолжение первого абзаца", "Второй абзац после паузы"]);
    expect(JSON.stringify(r)).not.toContain("@test_side");
  });

  it("reads products with prices and the «или» alternative flag", () => {
    expect(r.products).toEqual([
      { name: "тестовый гель альфа", price: "1 800 ₽", isAlternative: false },
      { name: "тестовая пенка бета", price: "2450p", isAlternative: true },
      { name: "тестовый крем", price: "аптека ₽", isAlternative: false },
    ]);
  });

  it("reads procedure rows by column", () => {
    expect(r.procedures).toHaveLength(2);
    expect(r.procedures[0]).toMatchObject({ name: "тестовая процедура один курс из трёх сеансов", price: "9 000 ₽", isAlternative: false });
    expect(r.procedures[1]).toMatchObject({ price: "от 8 500 ₽", isAlternative: true });
  });

  it("reports pages it cannot place instead of guessing", () => {
    const odd = parseCard([cover, personal, blank]);
    expect(odd.unrecognised).toEqual([3]);
  });

  it("builds duplicate keys that ignore case and punctuation", () => {
    expect(candidateKey("product", "Крем, ЁЖИК!")).toBe(candidateKey("product", "крем ежик"));
    expect(candidateKey("product", "крем")).not.toBe(candidateKey("text_block", "крем"));
  });

  it("extracts plain numeric prices only", () => {
    expect(priceAmount("1 800 ₽")).toBe(1800);
    expect(priceAmount("2450p")).toBe(2450);
    expect(priceAmount("3500/3700 р")).toBeNull();
    expect(priceAmount("аптека ₽")).toBeNull();
  });
});
