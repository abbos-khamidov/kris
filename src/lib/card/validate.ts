import type { CardData } from "@/lib/schemas/card";
import { stripInline } from "@/pdf/inline";

/**
 * Pre-approval checks. They only REPORT: nothing is corrected automatically and no medical
 * decision is made by the app (the specialist reviews every item). The keyword lists below are a
 * deliberately small, non-exhaustive safety net, NOT medical advice.
 */
export type Severity = "error" | "warning";
export interface Issue {
  id: string;
  severity: Severity;
  page: string;
  message: string;
}

const textOf = (blocks: CardData["skin"]["blocks"]) =>
  blocks
    .map((b) => [b.title, b.text, ...b.items, ...b.rows.flat()].join(" "))
    .join("\n");

const allText = (c: CardData) =>
  [
    textOf(c.skin.blocks),
    textOf(c.care.morning),
    textOf(c.care.evening),
    textOf(c.care.notes),
    textOf(c.actives.blocks),
    textOf(c.actives.note),
    textOf(c.vitamins.supplements),
    c.products.items.map((i) => `${i.brand} ${i.name}`).join(" "),
    c.procedures.plans.flatMap((p) => p.items.map((i) => `${i.name} ${i.description}`)).join(" "),
  ]
    .map(stripInline)
    .join("\n")
    .toLowerCase()
    .replace(/ё/g, "е");

/** Ingredient groups commonly flagged for pregnancy / lactation. Roots only — matched as substrings. */
const PREGNANCY_FLAGS = ["ретиноид", "ретинол", "ретиналь", "изотретиноин", "роаккутан", "адапален", "третиноин", "тазаротен", "ботулин", "ботокс"];
/** Units a dosage may carry; a number next to a supplement without one is flagged. */
const UNIT = /(мг|мкг|г\b|гр\b|мл|ме\b|ед\b|iu|капс|таб|раз|в сутки|в день|%)/i;

const unitless = (line: string) => /\d/.test(line) && !UNIT.test(line);

export function validateCard(c: CardData): Issue[] {
  const out: Issue[] = [];
  const add = (severity: Severity, page: string, id: string, message: string) => out.push({ id, severity, page, message });
  const p = c.personal;

  if (!p.fullName.trim()) add("error", "Личные данные", "name", "Не указано ФИО.");

  // Completeness of medical fields: "not specified" is allowed, but the specialist must see it.
  const unspecified: [string, string][] = [
    ["Аллергии", p.allergiesState],
    ["Хронические заболевания", p.chronicState],
    ["Щитовидная железа", p.thyroidState],
    ["Анализы на гормоны", p.hormoneTests],
    ["Цикл", p.cycle],
    ["Беременность", p.pregnancy],
    ["Лактация", p.lactation],
  ];
  for (const [label, v] of unspecified) {
    if (v === "unspecified") add("warning", "Личные данные", `unspec-${label}`, `«${label}»: не указано. Уточните или оставьте осознанно.`);
  }
  if (p.sebum === null) add("warning", "Личные данные", "sebum", "Тип себосекреции не указан.");
  if ((p.allergiesState === "yes" && !p.allergies.trim()) || (p.chronicState === "yes" && !p.chronic.trim())) {
    add("warning", "Личные данные", "yes-no-detail", "Выбрано «Да», но нет уточнения (аллергии / хронические заболевания).");
  }

  // Potentially dangerous mismatches (report only).
  const text = allText(c);
  if (p.pregnancy === "yes" || p.pregnancy === "planning" || p.lactation === "yes") {
    const hits = PREGNANCY_FLAGS.filter((k) => text.includes(k));
    if (hits.length) {
      add(
        "warning",
        "Рекомендации",
        "pregnancy-flag",
        `Указана беременность/планирование/лактация, а в рекомендациях встречается: ${hits.join(", ")}. Проверьте совместимость.`,
      );
    }
  }
  if (p.allergiesState === "yes" && p.allergies.trim()) {
    const words = p.allergies
      .toLowerCase()
      .replace(/ё/g, "е")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 5);
    const hit = words.filter((w) => text.includes(w.slice(0, Math.max(5, w.length - 2))));
    if (hit.length) add("warning", "Рекомендации", "allergy-overlap", `Слова из «Аллергии» (${[...new Set(hit)].join(", ")}) встречаются в рекомендациях. Проверьте.`);
  }

  // Units of measurement.
  for (const b of c.vitamins.supplements) {
    const lines = b.type === "ul" || b.type === "ol" ? b.items : b.text.split("\n");
    for (const line of lines) {
      const plain = stripInline(line);
      if (plain.trim() && unitless(plain)) add("warning", "Витамины и анализы", `unit-${plain.slice(0, 24)}`, `Нет единиц измерения: «${plain.slice(0, 60)}».`);
    }
  }
  for (const plan of c.procedures.plans) {
    for (const it of plan.items) {
      if (it.dosage && !UNIT.test(it.dosage)) add("warning", "План процедур", `dose-${it.id}`, `«${it.name || "Процедура"}»: у дозировки нет единиц измерения.`);
    }
  }

  // Products / procedures: prices and volumes.
  c.products.items.forEach((it, i) => {
    const label = `${i + 1}. ${[it.brand, it.name].filter(Boolean).join(" ") || "без названия"}`;
    if (!it.name.trim()) add("error", "Рекомендованные средства", `p-name-${it.id}`, `Позиция ${i + 1}: нет названия.`);
    const priced = it.variants.some((v) => v.price.kind === "request" || (v.price.kind === "text" ? v.price.text.trim() : v.price.amount != null));
    if (!priced) add("warning", "Рекомендованные средства", `p-price-${it.id}`, `${label}: не указана цена.`);
    if (it.variants.length > 1 && it.variants.some((v) => !v.volume.trim())) {
      add("warning", "Рекомендованные средства", `p-vol-${it.id}`, `${label}: у нескольких вариантов должен быть указан объём.`);
    }
  });
  for (const plan of c.procedures.plans) {
    plan.items.forEach((it, i) => {
      if (!it.name.trim()) add("error", "План процедур", `pr-name-${it.id}`, `${plan.title}, п. ${i + 1}: нет названия процедуры.`);
      const priced = it.price.kind === "request" || (it.price.kind === "text" ? it.price.text.trim() : it.price.amount != null);
      if (!priced && it.name.trim()) add("warning", "План процедур", `pr-price-${it.id}`, `«${it.name}»: не указана стоимость.`);
      if (it.price.kind === "range" && it.price.amount != null && it.price.max != null && it.price.max < it.price.amount) {
        add("error", "План процедур", `pr-range-${it.id}`, `«${it.name}»: верхняя граница диапазона меньше нижней.`);
      }
    });
  }

  // Empty standard sections.
  const empty: [string, boolean][] = [
    ["Состояние кожи", c.skin.blocks.length === 0],
    ["Схема ухода", c.care.morning.length === 0 && c.care.evening.length === 0],
    ["Заключение", c.conclusion.blocks.length === 0],
  ];
  for (const [label, isEmpty] of empty) if (isEmpty) add("warning", label, `empty-${label}`, `Раздел «${label}» пуст.`);

  return out;
}
