import { z } from "zod";
import { Price, Tri, emptyPrice, longText, shortText, uid } from "./common";

/**
 * Card data (stored as JSONB, validated on the server with these schemas).
 * Inline formatting inside text uses a tiny markup: **bold**, ==highlight==, !!warning!! (see pdf/inline.ts).
 */

/**
 * Block types: heading, paragraph (rich inline text), numbered/bulleted list, table,
 * image, note (highlighted remark), custom (titled free block).
 */
export const BLOCK_TYPES = ["h", "p", "ol", "ul", "table", "img", "note", "custom"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];
export const BLOCK_LABEL: Record<BlockType, string> = {
  h: "Заголовок",
  p: "Абзац",
  ol: "Нумерованный список",
  ul: "Маркированный список",
  table: "Таблица",
  img: "Изображение",
  note: "Примечание",
  custom: "Индивидуальный блок",
};
export const Block = z.object({
  id: z.string(),
  type: z.enum(BLOCK_TYPES),
  /** h/p/note: the text. custom: the body. */
  text: longText().default(""),
  /** custom/note/table: optional title. */
  title: shortText(120).default(""),
  /** ul/ol items. */
  items: z.array(longText(2000)).max(60).default([]),
  /** table rows (first row is the header when `header` is true). */
  rows: z.array(z.array(shortText(300)).max(6)).max(40).default([]),
  header: z.boolean().default(true),
  assetId: z.string().nullable().default(null),
  caption: shortText(200).default(""),
});
export type Block = z.infer<typeof Block>;
const Blocks = z.array(Block).max(120).default([]);

export const mkBlock = (type: BlockType, text = ""): Block => ({
  id: uid(),
  type,
  text: type === "ul" || type === "ol" || type === "table" ? "" : text,
  title: "",
  items: type === "ul" || type === "ol" ? (text ? text.split("\n") : [""]) : [],
  rows: type === "table" ? [["", ""], ["", ""]] : [],
  header: true,
  assetId: null,
  caption: "",
});

export const COVER_VARIANTS = ["frame", "burgundy-bottom", "burgundy-top"] as const;
export const COVER_VARIANT_LABEL: Record<(typeof COVER_VARIANTS)[number], string> = {
  frame: "Белая рамка сверху",
  "burgundy-bottom": "Бордовый заголовок снизу",
  "burgundy-top": "Бордовый заголовок сверху и ФИО снизу",
};
export const TITLE_COLORS = ["white", "burgundy", "dark"] as const;

export const BRAND_ROLES = [
  "cover",
  "bg_products",
  "bg_room",
  "face_illustration",
  "side_actives_top",
  "side_actives_bottom",
  "side_nutrition",
  "side_vitamins",
  "specialist",
  "logo",
] as const;
export type BrandRole = (typeof BRAND_ROLES)[number];

export const Design = z.object({
  coverVariant: z.enum(COVER_VARIANTS).default("frame"),
  coverTitle: shortText(60).default("КАРТА ПАЦИЕНТА"),
  coverTitleColor: z.enum(TITLE_COLORS).default("white"),
  coverNameColor: z.enum(TITLE_COLORS).default("white"),
  /** Per-card override of a brand image role; null/absent = use the brand library default. */
  imageOverrides: z.record(z.string(), z.string()).default({}),
  showSideText: z.boolean().default(true),
  includePhotosPage: z.boolean().default(false),
});
export type Design = z.infer<typeof Design>;

export const CustomField = z.object({ id: z.string(), label: shortText(80), value: shortText(400) });
export type CustomField = z.infer<typeof CustomField>;

export const PREGNANCY = ["yes", "no", "planning", "unknown", "unspecified"] as const;
export const CYCLE = ["regular", "irregular", "unknown", "unspecified"] as const;

export const Personal = z.object({
  fullName: shortText(160).default(""),
  ageText: shortText(40).default(""),
  allergies: shortText(400).default(""),
  allergiesState: Tri.default("unspecified"),
  chronic: shortText(400).default(""),
  chronicState: Tri.default("unspecified"),
  thyroid: shortText(400).default(""),
  thyroidState: Tri.default("unspecified"),
  hormoneTests: Tri.default("unspecified"),
  hormoneTestsNote: shortText(300).default(""),
  cycle: z.enum(CYCLE).default("unspecified"),
  pregnancy: z.enum(PREGNANCY).default("unspecified"),
  lactation: Tri.default("unspecified"),
  /** 1..5, halves allowed. null = not specified. */
  sebum: z.number().min(1).max(5).nullable().default(null),
  sebumText: shortText(40).default(""),
  custom: z.array(CustomField).max(20).default([]),
});
export type Personal = z.infer<typeof Personal>;

export const HOME_CARE_DECISIONS = ["keep", "replace", "exclude", "later"] as const;
export const HOME_CARE_LABEL: Record<(typeof HOME_CARE_DECISIONS)[number], string> = {
  keep: "Оставить",
  replace: "Заменить",
  exclude: "Исключить",
  later: "Добавить позднее",
};
export const HomeCareItem = z.object({
  id: z.string(),
  name: shortText(160),
  decision: z.enum(HOME_CARE_DECISIONS).default("keep"),
  note: shortText(400).default(""),
});

export const Stroke = z.object({
  id: z.string(),
  color: z.enum(["green", "red"]),
  /** Normalised 0..1 coordinates relative to the illustration, stored separately from the image. */
  points: z.array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)])).min(2).max(2000),
  width: z.number().min(0.002).max(0.05).default(0.012),
});
export type Stroke = z.infer<typeof Stroke>;

export const Face = z.object({
  illustrationId: z.string().nullable().default(null),
  strokes: z.array(Stroke).max(200).default([]),
});

export const ProductVariant = z.object({
  id: z.string(),
  volume: shortText(40).default(""),
  price: Price.default(emptyPrice()),
});
export const ProductItem = z.object({
  id: z.string(),
  /** Catalog id is only a hint; name/brand/prices are copied so later catalog edits never alter this card. */
  productId: z.string().nullable().default(null),
  /** Heading shown before the first item of a group, e.g. «очищение:». */
  label: shortText(80).default(""),
  brand: shortText(80).default(""),
  name: shortText(200).default(""),
  /** Rendered with the «или» prefix: an alternative to the previous item. */
  isAlternative: z.boolean().default(false),
  variants: z.array(ProductVariant).max(8).default([]),
  note: shortText(400).default(""),
  url: z.string().max(500).default(""),
});
export type ProductItem = z.infer<typeof ProductItem>;

export const ProcedureItem = z.object({
  id: z.string(),
  name: shortText(200).default(""),
  description: longText(1500).default(""),
  sessions: shortText(60).default(""),
  frequency: shortText(100).default(""),
  dosage: shortText(100).default(""),
  volume: shortText(60).default(""),
  isAlternative: z.boolean().default(false),
  price: Price.default(emptyPrice()),
});
export type ProcedureItem = z.infer<typeof ProcedureItem>;
export const ProcedurePlan = z.object({
  id: z.string(),
  title: shortText(80).default("Основной план"),
  items: z.array(ProcedureItem).max(40).default([]),
});
export type ProcedurePlan = z.infer<typeof ProcedurePlan>;

export const ExtraPage = z.object({
  id: z.string(),
  kind: z.enum(["text", "photos"]),
  title: shortText(80).default("Дополнительно"),
  blocks: Blocks,
  photoIds: z.array(z.string()).max(12).default([]),
});
export type ExtraPage = z.infer<typeof ExtraPage>;

export const CardData = z.object({
  schemaVersion: z.literal(1).default(1),
  design: Design.default(Design.parse({})),
  personal: Personal.default(Personal.parse({})),
  skin: z.object({ blocks: Blocks, photoIds: z.array(z.string()).max(6).default([]) }).default({ blocks: [], photoIds: [] }),
  care: z
    .object({
      morningTitle: shortText(60).default("Утро:"),
      morning: Blocks,
      eveningTitle: shortText(60).default("Вечер:"),
      evening: Blocks,
      notes: Blocks,
      face: Face.default({ illustrationId: null, strokes: [] }),
      homeCare: z.array(HomeCareItem).max(40).default([]),
    })
    .default({ morningTitle: "Утро:", morning: [], eveningTitle: "Вечер:", evening: [], notes: [], face: { illustrationId: null, strokes: [] }, homeCare: [] }),
  actives: z
    .object({ blocks: Blocks, noteTitle: shortText(60).default("Примечание:"), note: Blocks })
    .default({ blocks: [], noteTitle: "Примечание:", note: [] }),
  nutrition: z
    .object({
      mainTitle: shortText(80).default("Рекомендации по питанию:"),
      main: Blocks,
      extraTitle: shortText(80).default("Дополнения:"),
      extra: Blocks,
    })
    .default({ mainTitle: "Рекомендации по питанию:", main: [], extraTitle: "Дополнения:", extra: [] }),
  vitamins: z
    .object({
      supplementsTitle: shortText(80).default("Рекомендации по БАДам и витаминам:"),
      supplements: Blocks,
      testsTitle: shortText(80).default("Рекомендации по анализам:"),
      tests: Blocks,
    })
    .default({ supplementsTitle: "Рекомендации по БАДам и витаминам:", supplements: [], testsTitle: "Рекомендации по анализам:", tests: [] }),
  products: z
    .object({
      items: z.array(ProductItem).max(80).default([]),
      footnote: longText(600).default(
        "*Все средства по выгодным ценам вы можете приобрести в студии. Или по ссылкам на официальных сайтах. Пожалуйста не заказывайте косметику на маркетплейсах и сторонних сайтах, за её качество ответственность никто не несет.",
      ),
    })
    .default({ items: [], footnote: "" }),
  procedures: z.object({ plans: z.array(ProcedurePlan).max(6).default([]) }).default({ plans: [] }),
  conclusion: z
    .object({ blocks: Blocks, buttonLabel: shortText(40).default("Связаться со мной") })
    .default({ blocks: [], buttonLabel: "Связаться со мной" }),
  extraPages: z.array(ExtraPage).max(10).default([]),
});
export type CardData = z.infer<typeof CardData>;

export const emptyCardData = (): CardData => CardData.parse({});

/** The ten standard pages, in order. Titles come straight from the references. */
export const PAGE_KEYS = [
  "cover",
  "personal",
  "skin",
  "care",
  "actives",
  "nutrition",
  "vitamins",
  "products",
  "procedures",
  "conclusion",
] as const;
export type PageKey = (typeof PAGE_KEYS)[number];
export const PAGE_TITLES: Record<PageKey, string> = {
  cover: "Обложка",
  personal: "Личные данные",
  skin: "Состояние кожи",
  care: "Схема ухода",
  actives: "Активы и лечебные средства",
  nutrition: "Питание",
  vitamins: "Витамины и анализы",
  products: "Рекомендованные средства",
  procedures: "План процедур",
  conclusion: "Заключение",
};

export const productLine = (i: ProductItem) => [i.brand, i.name].filter(Boolean).join(" ");
