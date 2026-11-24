"use client";
import { signedUrlsAction } from "@/app/(app)/media/actions";
import { buildCardSnapshot, type AssetLoader, type DocContext } from "@/lib/card/resolve";
import { blobToDataUrl } from "@/lib/media/process";
import type { CardData } from "@/lib/schemas/card";
import type { CardSnapshot } from "@/pdf/snapshot";

/** In-memory (per tab) cache: asset id -> data URL. Assets are immutable, so entries never go stale. */
const cache = new Map<string, string>();

export const loadAssetsAsDataUrls: AssetLoader = async (ids) => {
  const missing = ids.filter((id) => !cache.has(id));
  if (missing.length) {
    const res = await signedUrlsAction(missing);
    if (!res.ok) throw new Error(res.error);
    await Promise.all(
      Object.entries(res.data).map(async ([id, url]) => {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) throw new Error("Не удалось загрузить изображение");
        cache.set(id, await blobToDataUrl(await r.blob()));
      }),
    );
  }
  return Object.fromEntries(ids.filter((id) => cache.has(id)).map((id) => [id, cache.get(id)!]));
};

export function snapshotFor(ctx: DocContext, card: CardData): Promise<CardSnapshot> {
  return buildCardSnapshot(ctx, card, loadAssetsAsDataUrls);
}

/**
 * THE client renderer entry point: preview, download, share and approval all call this with the same
 * snapshot, so the file the patient receives is exactly what the specialist previewed.
 */
export async function renderPdfBlob(snapshot: CardSnapshot): Promise<Blob> {
  const [{ pdf }, { CardDocument }, { registerPdfFonts }, React] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/pdf/CardDocument"),
    import("@/pdf/fonts"),
    import("react"),
  ]);
  registerPdfFonts("/fonts");
  return pdf(React.createElement(CardDocument, { snapshot }) as never).toBlob();
}
