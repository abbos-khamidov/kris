"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guard, ok } from "@/lib/action";
import { getCtx } from "@/lib/db";
import { ProductVariantInput } from "./schema";
import { DEFAULT_CATEGORIES } from "@/lib/templates";
import { logActivity } from "@/lib/services/activity";

export interface CatalogProduct {
  id: string;
  name: string;
  brand: string;
  categoryId: string | null;
  description: string;
  variants: z.infer<typeof ProductVariantInput>[];
  url: string;
  restrictions: string;
  alternatives: { name: string; brand: string }[];
  inStock: boolean;
  archived: boolean;
}

interface Row {
  name: string;
  brand: string;
  category_id: string | null;
  description: string;
  variants: unknown;
  url: string;
  restrictions: string;
  alternatives: unknown;
  in_stock: boolean;
  archived_at: string | null;
}

const toProduct = (r: Row & { id: string }): CatalogProduct => ({
  id: r.id,
  name: r.name,
  brand: r.brand,
  categoryId: r.category_id,
  description: r.description,
  variants: z.array(ProductVariantInput).catch([]).parse(r.variants),
  url: r.url,
  restrictions: r.restrictions,
  alternatives: z.array(z.object({ name: z.string(), brand: z.string() })).catch([]).parse(r.alternatives),
  inStock: r.in_stock,
  archived: !!r.archived_at,
});

/** The default categories are created once, on first use. */
export async function ensureCategories() {
  const ctx = await getCtx();
  let cats = await ctx.db.select<{ name: string; sort: number }>("product_categories", { order: { col: "sort", asc: true } });
  if (cats.length === 0) {
    for (const [i, name] of DEFAULT_CATEGORIES.entries()) await ctx.db.insert("product_categories", { name, sort: i });
    cats = await ctx.db.select<{ name: string; sort: number }>("product_categories", { order: { col: "sort", asc: true } });
  }
  return cats.map((c) => ({ id: c.id, name: c.name }));
}

export async function listProductsAction(input: { q?: string; categoryId?: string; includeArchived?: boolean } = {}) {
  return guard<CatalogProduct[]>(async () => {
    const ctx = await getCtx();
    const rows = await ctx.db.select<Row>("products", { order: { col: "name", asc: true }, limit: 1000 });
    const q = (input.q ?? "").trim().toLowerCase();
    const list = rows
      .map(toProduct)
      .filter((p) => (input.includeArchived ? true : !p.archived))
      .filter((p) => !input.categoryId || p.categoryId === input.categoryId)
      .filter((p) => !q || `${p.brand} ${p.name} ${p.description}`.toLowerCase().includes(q));
    return ok(list);
  });
}

const Save = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Укажите название").max(200),
  brand: z.string().trim().max(80).default(""),
  categoryId: z.string().nullable().default(null),
  description: z.string().max(3000).default(""),
  variants: z.array(ProductVariantInput).max(8).default([]),
  url: z.string().trim().max(500).default(""),
  restrictions: z.string().max(2000).default(""),
  alternatives: z.array(z.object({ name: z.string().trim().max(200), brand: z.string().trim().max(80) })).max(10).default([]),
  inStock: z.boolean().default(true),
});

/** Editing the catalog never changes approved cards: cards copy name/brand/prices at the moment of adding. */
export async function saveProductAction(input: unknown) {
  return guard<{ id: string }>(async () => {
    const ctx = await getCtx();
    const v = Save.parse(input);
    if (v.url && !/^https?:\/\//i.test(v.url)) return { ok: false as const, error: "Ссылка должна начинаться с http:// или https://" };
    const values = {
      name: v.name,
      brand: v.brand,
      category_id: v.categoryId,
      description: v.description,
      variants: v.variants,
      url: v.url,
      restrictions: v.restrictions,
      alternatives: v.alternatives.filter((a) => a.name),
      in_stock: v.inStock,
    };
    const row = v.id
      ? await ctx.db.update("products", v.id, values)
      : await ctx.db.insert("products", { ...values, image_asset_id: null, archived_at: null });
    await logActivity(ctx, v.id ? "product.update" : "product.create", "product", row.id);
    revalidatePath("/catalog");
    return ok({ id: row.id });
  });
}

export async function archiveProductAction(id: string, archived: boolean) {
  return guard(async () => {
    const ctx = await getCtx();
    await ctx.db.update("products", id, { archived_at: archived ? new Date().toISOString() : null });
    await logActivity(ctx, archived ? "product.archive" : "product.restore", "product", id);
    revalidatePath("/catalog");
    return ok();
  });
}

