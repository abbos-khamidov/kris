import type { CardData } from "@/lib/schemas/card";
import type { Settings } from "@/lib/schemas/settings";
import type { CardSnapshot, ImageSrc } from "@/pdf/snapshot";
import type { BrandSlot } from "@/pdf/tokens";
import { referencedAssetIds } from "./assets";

/** What the editor page knows about the document besides the card data itself. */
export interface DocContext {
  patient: { fullName: string; birthDate: string | null };
  specialist: Settings["specialist"];
  contactUrl: string;
  sideText: string;
  /** Current brand images by slot (asset ids). */
  brandIds: Partial<Record<BrandSlot, string>>;
}

export type AssetLoader = (assetIds: string[]) => Promise<Record<string, ImageSrc>>;

/**
 * Builds the renderer input. Used by preview, download, share and approval alike — one function,
 * one result shape. Images are loaded through `load` (data URLs in the browser).
 */
export async function buildCardSnapshot(ctx: DocContext, card: CardData, load: AssetLoader): Promise<CardSnapshot> {
  const wanted = new Set<string>([...Object.values(ctx.brandIds), ...referencedAssetIds(card)]);
  const loaded = await load([...wanted]);
  const brand: CardSnapshot["brand"] = {};
  for (const [slot, id] of Object.entries(ctx.brandIds)) {
    if (id && loaded[id]) brand[slot as BrandSlot] = loaded[id];
  }
  const images: CardSnapshot["images"] = {};
  for (const id of referencedAssetIds(card)) if (loaded[id]) images[id] = loaded[id];
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    patient: ctx.patient,
    card,
    specialist: ctx.specialist,
    contactUrl: ctx.contactUrl,
    sideText: ctx.sideText,
    brand,
    images,
  };
}
