import type { CardData } from "@/lib/schemas/card";

/** Every media asset id a card refers to (blocks, photo lists, overrides, face illustration). */
export function referencedAssetIds(card: CardData): string[] {
  const ids = new Set<string>();
  const blocks = [
    ...card.skin.blocks,
    ...card.care.morning,
    ...card.care.evening,
    ...card.care.notes,
    ...card.actives.blocks,
    ...card.actives.note,
    ...card.nutrition.main,
    ...card.nutrition.extra,
    ...card.vitamins.supplements,
    ...card.vitamins.tests,
    ...card.conclusion.blocks,
    ...card.extraPages.flatMap((p) => p.blocks),
  ];
  for (const b of blocks) if (b.assetId) ids.add(b.assetId);
  card.skin.photoIds.forEach((i) => ids.add(i));
  card.extraPages.forEach((p) => p.photoIds.forEach((i) => ids.add(i)));
  Object.values(card.design.imageOverrides).forEach((i) => ids.add(i));
  if (card.care.face.illustrationId) ids.add(card.care.face.illustrationId);
  return [...ids];
}
