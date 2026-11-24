/** Template kinds of the reusable-recommendations library (no patient data ever lives here). */
export const TEMPLATE_KINDS = [
  "skin",
  "morning",
  "evening",
  "barrier",
  "actives",
  "nutrition",
  "vitamins",
  "tests",
  "procedures",
  "products",
  "conclusion",
  "face_scheme",
] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export const TEMPLATE_LABEL: Record<TemplateKind, string> = {
  skin: "Состояние кожи",
  morning: "Утренний уход",
  evening: "Вечерний уход",
  barrier: "Восстановление кожного барьера",
  actives: "Лечебные средства",
  nutrition: "Питание",
  vitamins: "Витамины",
  tests: "Анализы",
  procedures: "Процедуры",
  products: "Наборы косметических средств",
  conclusion: "Заключение",
  face_scheme: "Схемы нанесения средств",
};

/** Kinds whose body is a list of document blocks (editable with the block editor). */
export const BLOCK_KINDS: TemplateKind[] = ["skin", "morning", "evening", "barrier", "actives", "nutrition", "vitamins", "tests", "conclusion"];

export const DEFAULT_CATEGORIES = ["Очищение", "Тоники", "Сыворотки", "Кремы", "SPF", "Активы", "Другие"] as const;
