"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guard, ok } from "@/lib/action";
import { getCtx } from "@/lib/db";
import type { UploadPlan } from "@/lib/db/types";
import { BRAND_ROLES } from "@/lib/schemas/card";
import { getSettings, saveSettings } from "@/lib/services/settings";
import { logActivity } from "@/lib/services/activity";

const CATEGORIES = ["brand", "product", "specialist", "patient", "illustration"] as const;
const TYPES = { "image/jpeg": "jpg", "image/png": "png" } as const;

const UploadRequest = z.object({
  category: z.enum(CATEGORIES),
  contentType: z.enum(["image/jpeg", "image/png"]),
});

/**
 * Step 1 of a direct upload: returns a short-lived signed target. The browser sends the (already
 * optimised, EXIF-free) file straight to private Storage — it never passes through a serverless function.
 */
export async function requestUploadAction(input: unknown) {
  return guard<{ plan: UploadPlan; path: string }>(async () => {
    const ctx = await getCtx();
    const { category, contentType } = UploadRequest.parse(input);
    const path = `${ctx.user.id}/${category}/${randomUUID()}.${TYPES[contentType]}`;
    const plan = await ctx.storage.createUpload(path);
    return ok({ plan, path });
  });
}

const Register = z.object({
  path: z.string().min(10).max(300),
  category: z.enum(CATEGORIES),
  role: z.enum(BRAND_ROLES).nullable().default(null),
  name: z.string().max(200).default(""),
  contentType: z.enum(["image/jpeg", "image/png"]),
  width: z.number().int().positive().max(20000),
  height: z.number().int().positive().max(20000),
  sizeBytes: z.number().int().positive().max(60_000_000),
});

/** Step 2: verifies the object really exists in the caller's own folder, then records it. */
export async function registerAssetAction(input: unknown) {
  return guard<{ id: string }>(async () => {
    const ctx = await getCtx();
    const v = Register.parse(input);
    if (!v.path.startsWith(`${ctx.user.id}/`)) return { ok: false as const, error: "Недопустимый путь файла" };
    if (!(await ctx.storage.exists(v.path))) return { ok: false as const, error: "Файл не найден в хранилище" };
    const row = await ctx.db.insert("media_assets", {
      category: v.category,
      role: v.role,
      name: v.name,
      path: v.path,
      content_type: v.contentType,
      width: v.width,
      height: v.height,
      size_bytes: v.sizeBytes,
      version: 1,
      meta: {},
      archived_at: null,
    });
    await logActivity(ctx, "media.upload", "media_asset", row.id, { category: v.category });
    revalidatePath("/media");
    return ok({ id: row.id });
  });
}

/** Makes an uploaded asset the current brand image for a role. Old assets stay (approved PDFs keep their copy). */
export async function setBrandImageAction(role: string, assetId: string) {
  return guard(async () => {
    const ctx = await getCtx();
    const r = z.enum(BRAND_ROLES).parse(role);
    const asset = await ctx.db.get("media_assets", assetId);
    if (!asset) return { ok: false as const, error: "Изображение не найдено" };
    const settings = await getSettings(ctx);
    await saveSettings(ctx, { ...settings, brandImages: { ...settings.brandImages, [r]: assetId } });
    await logActivity(ctx, "brand.set", "settings", undefined, { role: r });
    revalidatePath("/settings");
    return ok();
  });
}

export async function archiveAssetAction(assetId: string) {
  return guard(async () => {
    const ctx = await getCtx();
    const settings = await getSettings(ctx);
    if (Object.values(settings.brandImages).includes(assetId)) {
      return { ok: false as const, error: "Это изображение используется как фирменное. Сначала замените его." };
    }
    await ctx.db.update("media_assets", assetId, { archived_at: new Date().toISOString() });
    await logActivity(ctx, "media.archive", "media_asset", assetId);
    revalidatePath("/media");
    return ok();
  });
}

/** Short-lived signed URLs for the browser (never public, never cached by the service worker). */
export async function signedUrlsAction(assetIds: string[]) {
  return guard<Record<string, string>>(async () => {
    const ctx = await getCtx();
    const ids = z.array(z.string()).max(200).parse(assetIds);
    const out: Record<string, string> = {};
    for (const id of ids) {
      const a = await ctx.db.get<{ path: string }>("media_assets", id);
      if (a) out[id] = await ctx.storage.signedUrl(a.path, 900);
    }
    return ok(out);
  });
}

export interface AssetListItem {
  id: string;
  category: string;
  role: string | null;
  name: string;
  width: number | null;
  height: number | null;
  url: string;
  createdAt: string;
}

/** Library listing with short-lived signed thumbnails (no public URLs, nothing cached by the service worker). */
export async function listAssetsAction(category?: string) {
  return guard<AssetListItem[]>(async () => {
    const ctx = await getCtx();
    const where = category ? { category: z.enum(CATEGORIES).parse(category) } : undefined;
    const rows = await ctx.db.select<{
      category: string;
      role: string | null;
      name: string;
      path: string;
      width: number | null;
      height: number | null;
      archived_at: string | null;
    }>("media_assets", { where, order: { col: "created_at" }, limit: 300 });
    const live = rows.filter((r) => !r.archived_at);
    const items = await Promise.all(
      live.map(async (r) => ({
        id: r.id,
        category: r.category,
        role: r.role,
        name: r.name,
        width: r.width,
        height: r.height,
        url: await ctx.storage.signedUrl(r.path, 900),
        createdAt: r.created_at,
      })),
    );
    return ok(items);
  });
}
