import { describe, expect, it } from "vitest";
import { insertDictation } from "../src/lib/speech/insert";

describe("insertDictation", () => {
  it("inserts at the cursor without deleting anything", () => {
    const r = insertDictation("Утро: гель", "умывание", "cursor", 6, 6, true);
    expect(r.value).toBe("Утро: умывание гель");
    expect(r.caret).toBe("Утро: умывание ".length);
  });
  it("keeps the selection when inserting at the cursor", () => {
    expect(insertDictation("abc def", "X", "cursor", 0, 3, false).value).toBe("X abc def");
  });
  it("appends on a new line for multiline fields", () => {
    expect(insertDictation("первая строка", "вторая", "append", 0, 0, true).value).toBe("первая строка\nвторая");
  });
  it("appends with a space for single-line fields", () => {
    expect(insertDictation("Иванова", "Мария", "append", 0, 0, false).value).toBe("Иванова Мария");
  });
  it("replaces only the selected range", () => {
    expect(insertDictation("Омега 3 в сутки", "магний", "replace", 6, 7, false).value).toBe("Омега магний в сутки");
  });
  it("does not change the value for empty dictation", () => {
    expect(insertDictation("текст", "  ", "append", 0, 0, true).value).toBe("текст");
  });
  it("does not add a space before punctuation", () => {
    expect(insertDictation("Пить воду", ", много", "append", 0, 0, false).value).toBe("Пить воду, много");
  });
});
