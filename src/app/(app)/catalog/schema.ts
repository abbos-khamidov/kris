import { z } from "zod";
import { Price as PriceSchema } from "@/lib/schemas/common";

export const Price = PriceSchema;
export const ProductVariantInput = z.object({
  id: z.string(),
  volume: z.string().max(40).default(""),
  price: PriceSchema.default({ kind: "fixed", amount: null, max: null, text: "" }),
});
