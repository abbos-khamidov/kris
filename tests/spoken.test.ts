import { describe, expect, it } from "vitest";
import { applySpokenPunctuation, isSafeCorrection, joinPhrase, localTidy } from "../src/lib/speech/spoken";

describe("spoken punctuation", () => {
  it("turns unambiguous commands into characters", () => {
    expect(applySpokenPunctuation("наносить утром запятая вечером двоеточие гель")).toBe("наносить утром, вечером: гель");
    expect(applySpokenPunctuation("первый пункт новая строка второй пункт")).toBe("первый пункт\nвторой пункт");
    expect(applySpokenPunctuation("это важно восклицательный знак")).toBe("это важно!");
  });
  it("treats «точка» as a command only at the very end after a non-preposition", () => {
    expect(applySpokenPunctuation("наносить два раза в день точка")).toBe("наносить два раза в день.");
    expect(applySpokenPunctuation("нанести крем на точку")).toBe("нанести крем на точку");
    expect(applySpokenPunctuation("не трогать эту точку")).toBe("не трогать эту точку");
    expect(applySpokenPunctuation("точка нанесения на лбу")).toBe("точка нанесения на лбу");
  });
});

describe("local tidy-up", () => {
  it("capitalises the start of a sentence only", () => {
    expect(localTidy("умывание гелем", "")).toBe("Умывание гелем");
    expect(localTidy("затем крем", "Умывание гелем.")).toBe("Затем крем");
    expect(localTidy("затем крем", "Умывание гелем,")).toBe("затем крем");
    expect(localTidy("второй пункт", "первый\n")).toBe("Второй пункт");
  });
  it("fixes spacing around punctuation and never touches numbers or units", () => {
    expect(localTidy("омега 3  1000 мг , вечером", "x")).toBe("омега 3 1000 мг, вечером");
    expect(localTidy("витамин д 2500 ме", "")).toBe("Витамин д 2500 ме");
  });
  it("joins phrases with exactly one separator", () => {
    expect(joinPhrase("Первая фраза.", "Вторая")).toBe("Первая фраза. Вторая");
    expect(joinPhrase("Первая", ", вторая")).toBe("Первая, вторая");
    expect(joinPhrase("", "Текст")).toBe("Текст");
    expect(joinPhrase("Строка\n", "Новая")).toBe("Строка\nНовая");
  });
});

describe("AI correction safety net", () => {
  it("accepts a normal spelling/punctuation fix", () => {
    expect(isSafeCorrection("наносить утром и вечеру на сухую кожу", "Наносить утром и вечером на сухую кожу.")).toBe(true);
  });
  it("rejects any change to numbers (doses)", () => {
    expect(isSafeCorrection("омега 3 1000 мг в сутки", "Омега-3 500 мг в сутки.")).toBe(false);
    expect(isSafeCorrection("магний 400 мг", "Магний 400 мг и 200 мг.")).toBe(false);
    expect(isSafeCorrection("цинк 22,5 мг", "Цинк 22.5 мг.")).toBe(true);
  });
  it("rejects rewrites, additions and empty output", () => {
    expect(isSafeCorrection("крем два раза", "")).toBe(false);
    expect(isSafeCorrection("крем два раза", "Рекомендуется наносить крем два раза в день, избегая области вокруг глаз и губ.")).toBe(false);
    expect(isSafeCorrection("крем два раза в день утром и вечером", "Крем.")).toBe(false);
  });
});
