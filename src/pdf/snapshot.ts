import type { CardData } from "@/lib/schemas/card";
import type { Settings } from "@/lib/schemas/settings";
import type { BrandSlot } from "./tokens";

/** Raw bytes (Node/tests) or a data/blob/https URL (browser). */
export type ImageSrc = string | { data: Uint8Array; format: "jpg" | "png" };

/**
 * Everything the renderer needs — and nothing else. The same object drives preview, download,
 * sharing and the stored approved PDF, so they can never diverge (ADR-003).
 */
export interface CardSnapshot {
  version: 1;
  generatedAt: string;
  patient: { fullName: string; birthDate: string | null };
  card: CardData;
  specialist: Settings["specialist"];
  contactUrl: string;
  sideText: string;
  /** Resolved brand images for this document (frozen at approval). */
  brand: Partial<Record<BrandSlot, ImageSrc>>;
  /** Other images referenced by id from blocks / photo pages. */
  images: Record<string, ImageSrc>;
}
