import { describe, expect, it } from "vitest";
import { cloneCardData, newCardData, personalFromPatient } from "../src/lib/card/build";
import { sha256Hex, stableStringify } from "../src/lib/card/hash";
import { validateCard } from "../src/lib/card/validate";
import { CardData, mkBlock } from "../src/lib/schemas/card";
import { Settings } from "../src/lib/schemas/settings";
import { sampleSnapshot } from "../src/pdf/sample";

const patient = { full_name: "Вымышленная Анна", birth_date: "1996-03-10" };
const settings = Settings.parse({});

describe("card building", () => {
  it("never turns missing anamnesis into negative answers", () => {
    const p = personalFromPatient(patient, null, new Date("2026-11-25"));
    expect(p.allergiesState).toBe("unspecified");
    expect(p.pregnancy).toBe("unspecified");
    expect(p.lactation).toBe("unspecified");
    expect(p.hormoneTests).toBe("unspecified");
    expect(p.ageText).toBe("30 лет");
  });

  it("uses the brand defaults from settings", () => {
    const s = Settings.parse({ pdf: { coverVariant: "burgundy-top", coverTitleColor: "burgundy", coverNameColor: "burgundy", buttonLabel: "Написать мне" } });
    const c = newCardData(patient, null, s);
    expect(c.design.coverVariant).toBe("burgundy-top");
    expect(c.conclusion.buttonLabel).toBe("Написать мне");
  });

  it("cloning reuses recommendations but rebuilds personal data for the new patient", () => {
    const prev = sampleSnapshot("short-frame").card;
    prev.personal.allergies = "данные другого пациента";
    prev.personal.allergiesState = "yes";
    const next = cloneCardData(prev, { full_name: "Другая Пациентка", birth_date: null }, { allergies_state: "no" });
    expect(next.personal.fullName).toBe("Другая Пациентка");
    expect(next.personal.allergies).toBe("");
    expect(next.personal.allergiesState).toBe("no");
    expect(next.skin.blocks).toEqual(prev.skin.blocks);
    expect(next).not.toBe(prev);
  });
});

describe("pre-approval validation (reports only, never edits)", () => {
  const base = () => CardData.parse(newCardData(patient, null, settings));

  it("flags every unspecified medical field", () => {
    const issues = validateCard(base());
    const msgs = issues.map((i) => i.message).join("\n");
    for (const f of ["Аллергии", "Хронические заболевания", "Щитовидная железа", "Анализы на гормоны", "Цикл", "Беременность", "Лактация"]) {
      expect(msgs).toContain(`«${f}»: не указано`);
    }
  });

  it("flags pregnancy vs retinoid mismatch", () => {
    const c = base();
    c.personal.pregnancy = "planning";
    c.actives.blocks = [mkBlock("p", "Наносить ретинол по вечерам")];
    expect(validateCard(c).some((i) => i.id === "pregnancy-flag")).toBe(true);
  });

  it("does not flag when pregnancy is explicitly no", () => {
    const c = base();
    c.personal.pregnancy = "no";
    c.actives.blocks = [mkBlock("p", "Наносить ретинол по вечерам")];
    expect(validateCard(c).some((i) => i.id === "pregnancy-flag")).toBe(false);
  });

  it("flags allergy words that appear in recommendations", () => {
    const c = base();
    c.personal.allergiesState = "yes";
    c.personal.allergies = "миндальное масло";
    c.skin.blocks = [mkBlock("p", "Крем на основе миндального масла")];
    expect(validateCard(c).some((i) => i.id === "allergy-overlap")).toBe(true);
  });

  it("flags supplement lines without units", () => {
    const c = base();
    c.vitamins.supplements = [{ ...mkBlock("ol"), items: ["Магний 400", "Омега 3 1000 мг в сутки"] }];
    const unit = validateCard(c).filter((i) => i.id.startsWith("unit-"));
    expect(unit).toHaveLength(1);
    expect(unit[0].message).toContain("Магний 400");
  });

  it("flags inverted ranges and missing names as errors", () => {
    const c = sampleSnapshot("mixed-burgundy-top").card;
    c.procedures.plans[0].items[1].price = { kind: "range", amount: 20000, max: 10000, text: "" };
    c.procedures.plans[0].items[0].name = "";
    const errors = validateCard(c).filter((i) => i.severity === "error");
    expect(errors.some((e) => e.id.startsWith("pr-range-"))).toBe(true);
    expect(errors.some((e) => e.id.startsWith("pr-name-"))).toBe(true);
  });

  it("validation is read-only", () => {
    const c = base();
    const before = JSON.stringify(c);
    validateCard(c);
    expect(JSON.stringify(c)).toBe(before);
  });
});

describe("snapshot hash", () => {
  it("is independent of key order and sensitive to content", async () => {
    const a = await sha256Hex(stableStringify({ b: 1, a: [1, { y: 2, x: 1 }] }));
    const b = await sha256Hex(stableStringify({ a: [1, { x: 1, y: 2 }], b: 1 }));
    const c = await sha256Hex(stableStringify({ a: [1, { x: 1, y: 3 }], b: 1 }));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(64);
  });
});
