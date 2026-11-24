import { CardData, mkBlock, type Block, type ProductItem, type ProcedureItem } from "@/lib/schemas/card";
import { emptyPrice, uid, type Price } from "@/lib/schemas/common";
import type { CardSnapshot } from "./snapshot";

/**
 * Fictional demo data for tests, screenshots and the seed. It contains NO real patients and NO
 * real medical recommendations — texts are neutral placeholders written for layout checks.
 */

const para = (text: string): Block => mkBlock("p", text);
const list = (kind: "ol" | "ul", items: string[]): Block => ({ ...mkBlock(kind), items });

const price = (amount: number | null, kind: Price["kind"] = "fixed", max: number | null = null, text = ""): Price => ({
  kind,
  amount,
  max,
  text,
});

const product = (brand: string, name: string, p: Price, extra: Partial<ProductItem> = {}): ProductItem => ({
  id: uid(),
  productId: null,
  label: "",
  brand,
  name,
  isAlternative: false,
  variants: [{ id: uid(), volume: "", price: p }],
  note: "",
  url: "",
  ...extra,
});

const proc = (name: string, p: Price, extra: Partial<ProcedureItem> = {}): ProcedureItem => ({
  id: uid(),
  name,
  description: "",
  sessions: "",
  frequency: "",
  dosage: "",
  volume: "",
  isAlternative: false,
  price: p,
  ...extra,
});

const LOREM =
  "Это тестовый текст для проверки вёрстки: перенос строк, межстрочные интервалы и отступы. Он не содержит медицинских рекомендаций.";

export type SampleKind = "short-frame" | "long-burgundy-bottom" | "mixed-burgundy-top";

export function sampleSnapshot(kind: SampleKind): CardSnapshot {
  const base = CardData.parse({});
  const card = structuredClone(base);
  let fullName = "Вымышленная Анна Тестовна";

  card.personal = {
    ...card.personal,
    fullName,
    ageText: "30 лет",
    allergies: "нет",
    allergiesState: "no",
    chronicState: "no",
    thyroidState: "unknown",
    hormoneTests: "no",
    cycle: "regular",
    pregnancy: "no",
    lactation: "no",
    sebum: 3.5,
    sebumText: "3-4",
  };
  card.skin.blocks = [para(LOREM), para("Второй абзац с ==важным выделением== и **жирным текстом**. " + LOREM), list("ul", ["Первый пункт списка", "Второй пункт списка"])];
  card.care.morning = [list("ol", ["Умывание", "Тоник", "Сыворотка", "Крем", "SPF"])];
  card.care.evening = [list("ol", ["Умывание", "Крем"])];
  card.care.face.strokes = [
    { id: uid(), color: "green", width: 0.012, points: [[0.3, 0.5], [0.4, 0.45], [0.5, 0.5], [0.6, 0.45], [0.7, 0.5]] },
    { id: uid(), color: "red", width: 0.012, points: [[0.32, 0.38], [0.4, 0.36]] },
    { id: uid(), color: "red", width: 0.012, points: [[0.6, 0.36], [0.68, 0.38]] },
  ];
  card.actives.blocks = [para(LOREM)];
  card.actives.note = [para("Пример примечания специалиста.")];
  card.nutrition.main = [para(LOREM)];
  card.nutrition.extra = [para("Дополнение: " + LOREM)];
  card.vitamins.supplements = [list("ol", ["Тестовая позиция 1", "Тестовая позиция 2"])];
  card.vitamins.tests = [para("Общий клинический анализ, ферритин, витамин D")];
  card.products.items = [
    product("Бренд Альфа", "тестовый гель для умывания", price(1800), { label: "очищение:" }),
    product("Бренд Бета", "тестовая пенка", price(2450), { isAlternative: true }),
    product("Бренд Гамма", "тестовый крем", price(2700)),
    product("Бренд Дельта", "тестовый SPF 50", price(3500, "text", null, "3500 ₽ / аптека")),
  ];
  card.procedures.plans = [
    {
      id: uid(),
      title: "Основной план",
      items: [
        proc("Тестовая процедура 1", price(9000, "from"), { sessions: "3 сеанса", frequency: "1 раз в 4 недели" }),
        proc("Тестовая процедура 2", price(8500, "range", 13000)),
        proc("Тестовая процедура 3", price(null, "request")),
      ],
    },
  ];
  card.conclusion.blocks = [para(LOREM), para("Контрольная консультация через месяц.")];

  if (kind === "short-frame") {
    card.design.coverVariant = "frame";
    card.design.coverTitleColor = "white";
    card.design.coverNameColor = "white";
  }

  if (kind === "long-burgundy-bottom") {
    fullName = "Вымышленная-Тестовская Александра Константиновна Младшая";
    card.personal.fullName = fullName;
    card.design.coverVariant = "burgundy-bottom";
    card.design.coverTitleColor = "burgundy";
    card.design.coverNameColor = "burgundy";
    const longText = Array.from({ length: 6 }, () => LOREM).join(" ");
    card.skin.blocks = [para(longText), para(longText), list("ul", Array.from({ length: 8 }, (_, i) => `Пункт ${i + 1}. ${LOREM}`)), para(longText), para(longText)];
    card.care.morning = [para(longText), list("ol", Array.from({ length: 6 }, (_, i) => `Шаг ${i + 1}: ${LOREM}`))];
    card.care.evening = [para(longText), list("ol", Array.from({ length: 6 }, (_, i) => `Шаг ${i + 1}: ${LOREM}`))];
    card.actives.blocks = [para(longText), para(longText), para(longText)];
    card.nutrition.main = [para(longText), para(longText)];
    card.vitamins.supplements = [list("ol", Array.from({ length: 10 }, (_, i) => `Позиция ${i + 1} — дозировка по назначению специалиста`))];
    card.products.items = Array.from({ length: 24 }, (_, i) =>
      product(`Бренд ${i + 1}`, `тестовое средство с достаточно длинным названием номер ${i + 1}`, price(1000 + i * 150), {
        isAlternative: i % 3 === 1,
        variants:
          i % 4 === 0
            ? [
                { id: uid(), volume: "30 мл", price: price(2500) },
                { id: uid(), volume: "50 мл", price: price(3800) },
                { id: uid(), volume: "100 мл", price: price(6100) },
              ]
            : [{ id: uid(), volume: i % 2 ? "50 мл" : "", price: price(1000 + i * 150) }],
        note: i % 5 === 0 ? "Индивидуальный комментарий специалиста к средству" : "",
      }),
    );
    card.procedures.plans = [
      {
        id: uid(),
        title: "Основной план",
        items: Array.from({ length: 8 }, (_, i) =>
          proc(`Тестовая процедура ${i + 1} с длинным названием для проверки переноса`, price(5000 + i * 700), {
            description: LOREM,
            sessions: "4 сеанса",
            frequency: "1 раз в 2 недели",
          }),
        ),
      },
    ];
    card.conclusion.blocks = [para(longText), para(longText), para(longText)];
  }

  if (kind === "mixed-burgundy-top") {
    fullName = "Вымышленная Ольга Тестова";
    card.personal.fullName = fullName;
    card.personal.pregnancy = "planning";
    card.personal.allergiesState = "unspecified";
    card.personal.allergies = "";
    card.personal.sebum = 3;
    card.personal.sebumText = "3";
    card.design.coverVariant = "burgundy-top";
    card.design.coverTitleColor = "burgundy";
    card.design.coverNameColor = "burgundy";
    card.procedures.plans = [
      {
        id: uid(),
        title: "Основной план",
        items: [
          proc("Тестовая процедура А", price(9000, "from")),
          proc("Тестовая процедура Б", price(8500, "range", 13000), { sessions: "3-5 процедур" }),
          proc("Тестовая процедура В", price(10000, "range", 15000), { frequency: "1 раз в 4-6 недель" }),
          proc("Тестовая процедура Г", price(35000, "approx"), { isAlternative: true }),
        ],
      },
      {
        id: uid(),
        title: "Вариант 2",
        items: [proc("Тестовая процедура Д", price(2800, "range", 3800)), proc("Тестовая процедура Е", price(null, "request"))],
      },
    ];
    card.care.homeCare = [
      { id: uid(), name: "Тестовый очищающий гель", decision: "keep", note: "" },
      { id: uid(), name: "Тестовый крем", decision: "replace", note: "заменить на подобранный" },
      { id: uid(), name: "Тестовая сыворотка", decision: "later", note: "" },
    ];
  }

  return {
    version: 1,
    generatedAt: "2026-01-01T00:00:00.000Z",
    patient: { fullName, birthDate: null },
    card,
    specialist: { name: "Тестовый Косметолог", title: "Косметолог", phone: "+70000000000", whatsapp: "", telegram: "", instagram: "", website: "" },
    contactUrl: "https://example.com/contact",
    sideText: "@test_cosmetologist",
    brand: {},
    images: {},
  };
}

export { emptyPrice };
