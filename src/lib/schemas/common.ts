import { z } from "zod";

export const uid = () => crypto.randomUUID();

/** Medical yes/no fields. "unspecified" is the default; negatives are never assumed. */
export const TRI_VALUES = ["yes", "no", "unknown", "unspecified"] as const;
export const Tri = z.enum(TRI_VALUES);
export type Tri = z.infer<typeof Tri>;
export const TRI_LABEL: Record<Tri, string> = {
  yes: "Да",
  no: "Нет",
  unknown: "Неизвестно",
  unspecified: "Не указано",
};

export const PRICE_KINDS = ["fixed", "range", "from", "approx", "request", "text"] as const;
export const Price = z.object({
  kind: z.enum(PRICE_KINDS).default("fixed"),
  amount: z.number().nonnegative().nullable().default(null),
  max: z.number().nonnegative().nullable().default(null),
  /** Free text, e.g. «аптека» or «3500 ₽ / аптека». Used when kind === "text". */
  text: z.string().max(80).default(""),
});
export type Price = z.infer<typeof Price>;
export const emptyPrice = (): Price => ({ kind: "fixed", amount: null, max: null, text: "" });

export const PRICE_KIND_LABEL: Record<(typeof PRICE_KINDS)[number], string> = {
  fixed: "Фиксированная",
  range: "Диапазон",
  from: "От указанной суммы",
  approx: "Приблизительная",
  request: "По запросу",
  text: "Текст",
};

export const Money = z.number().nonnegative().max(100_000_000);
export const shortText = (max = 200) => z.string().trim().max(max);
export const longText = (max = 8000) => z.string().max(max);
