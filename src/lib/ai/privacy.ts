import "server-only";
import type { Ctx } from "@/lib/db/types";

/** What must be hidden (patient names) and kept (catalogue names) when text is sent for correction. */
export async function textGuards(ctx: Ctx) {
  const [patients, products] = await Promise.all([
    ctx.db.select<{ full_name: string }>("patients", { limit: 1000 }),
    ctx.db.select<{ name: string; brand: string }>("products", { limit: 300 }),
  ]);
  return {
    names: patients.map((p) => p.full_name),
    terms: products.map((p) => [p.brand, p.name].filter(Boolean).join(" ")).filter(Boolean),
  };
}
