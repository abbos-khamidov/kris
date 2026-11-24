import "server-only";
import type { Ctx } from "@/lib/db/types";
import { CardData } from "@/lib/schemas/card";
import { contactUrl, type Settings } from "@/lib/schemas/settings";
import { BRAND_SLOTS, type BrandSlot } from "@/pdf/tokens";
import { referencedAssetIds } from "@/lib/card/assets";
import type { DocContext } from "@/lib/card/resolve";
import { getSettings } from "./settings";
import type { PatientRow } from "@/lib/schemas/patient";

export interface CardRow {
  patient_id: string;
  consultation_id: string | null;
  title: string;
  status: "draft" | "approved";
  data: unknown;
  version: number;
  based_on_card_id: string | null;
  approved_at: string | null;
  archived_at?: string | null;
}

export interface AssetRef {
  assetId: string;
  path: string;
  contentType: string;
}

/**
 * The frozen, serialisable description of a document: card data + patient + brand/settings values +
 * the exact storage objects of every image used. Stored as the immutable snapshot at approval and
 * resolved to a CardSnapshot (with real image bytes) by the browser to render the PDF.
 */
export interface SnapshotRefs {
  version: 1;
  patient: { fullName: string; birthDate: string | null };
  card: CardData;
  specialist: Settings["specialist"];
  contactUrl: string;
  sideText: string;
  brand: Partial<Record<BrandSlot, AssetRef>>;
  images: Record<string, AssetRef>;
}

async function refFor(ctx: Ctx, assetId: string): Promise<AssetRef | null> {
  const a = await ctx.db.get<{ path: string; content_type: string }>("media_assets", assetId);
  return a ? { assetId, path: a.path, contentType: a.content_type } : null;
}

export async function buildSnapshotRefs(ctx: Ctx, card: CardRow & { id: string }): Promise<SnapshotRefs> {
  const data = CardData.parse(card.data);
  const patient = await ctx.db.get<PatientRow>("patients", card.patient_id);
  if (!patient) throw new Error("Пациент не найден");
  const settings = await getSettings(ctx);

  const brand: SnapshotRefs["brand"] = {};
  for (const slot of BRAND_SLOTS) {
    const id = settings.brandImages[slot];
    const ref = id ? await refFor(ctx, id) : null;
    if (ref) brand[slot] = ref;
  }
  const images: SnapshotRefs["images"] = {};
  for (const id of referencedAssetIds(data)) {
    const ref = await refFor(ctx, id);
    if (ref) images[id] = ref;
  }

  return {
    version: 1,
    patient: { fullName: patient.full_name, birthDate: patient.birth_date ?? null },
    card: data,
    specialist: settings.specialist,
    contactUrl: contactUrl(settings.specialist),
    sideText: settings.sideText,
    brand,
    images,
  };
}

/** The document context derived from the stored state (also the server side of the approval integrity check). */
export async function buildDocContext(ctx: Ctx, patientId: string): Promise<DocContext> {
  const patient = await ctx.db.get<PatientRow>("patients", patientId);
  if (!patient) throw new Error("Пациент не найден");
  const settings = await getSettings(ctx);
  const brandIds: DocContext["brandIds"] = {};
  for (const slot of BRAND_SLOTS) {
    const id = settings.brandImages[slot];
    if (id) brandIds[slot] = id;
  }
  return {
    patient: { fullName: patient.full_name, birthDate: patient.birth_date ?? null },
    specialist: settings.specialist,
    contactUrl: contactUrl(settings.specialist),
    sideText: settings.sideText,
    brandIds,
  };
}
