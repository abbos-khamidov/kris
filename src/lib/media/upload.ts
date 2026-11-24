"use client";
import { registerAssetAction, requestUploadAction } from "@/app/(app)/media/actions";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import type { BrandRole } from "@/lib/schemas/card";
import type { ProcessedImage } from "./process";

export interface UploadedAsset {
  id: string;
}

/**
 * Direct-to-Storage upload: signed target from the server, bytes straight from the browser to private
 * Storage (Supabase signed upload URL, or the signed local endpoint in demo mode).
 */
export async function uploadProcessed(
  img: ProcessedImage,
  meta: { category: "brand" | "product" | "specialist" | "patient" | "illustration"; role?: BrandRole | null; name?: string },
): Promise<UploadedAsset> {
  const req = await requestUploadAction({ category: meta.category, contentType: img.contentType });
  if (!req.ok) throw new Error(req.error);
  const { plan, path } = req.data;

  if (plan.kind === "supabase") {
    const { error } = await createSupabaseBrowser().storage.from(plan.bucket).uploadToSignedUrl(plan.path, plan.token, img.blob, {
      contentType: img.contentType,
    });
    if (error) throw new Error("Не удалось загрузить файл. Проверьте соединение и повторите.");
  } else {
    const res = await fetch(plan.url, { method: "PUT", body: img.blob, headers: { "content-type": img.contentType } });
    if (!res.ok) throw new Error("Не удалось загрузить файл. Проверьте соединение и повторите.");
  }

  const reg = await registerAssetAction({
    path,
    category: meta.category,
    role: meta.role ?? null,
    name: meta.name ?? "",
    contentType: img.contentType,
    width: img.width,
    height: img.height,
    sizeBytes: img.blob.size,
  });
  if (!reg.ok) throw new Error(reg.error);
  return reg.data;
}
