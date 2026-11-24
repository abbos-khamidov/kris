import { notFound } from "next/navigation";
import { getCtx } from "@/lib/db";
import { CardData } from "@/lib/schemas/card";
import { buildDocContext, type CardRow } from "@/lib/services/cards";
import { getUiPrefs } from "@/lib/services/settings";
import { ApprovedView } from "./approved-view";
import { CardEditor } from "./editor";

export const metadata = { title: "Карта пациента" };
export const dynamic = "force-dynamic";

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx();
  const card = await ctx.db.get<CardRow>("patient_cards", id);
  if (!card) notFound();
  const docCtx = await buildDocContext(ctx, card.patient_id);

  if (card.status === "approved") {
    const versions = await ctx.db.select<{ card_id: string; version: number; document_id: string | null; approved_at: string }>("card_versions", {
      where: { card_id: id },
      order: { col: "version" },
    });
    const docs = await ctx.db.select<{ file_name: string; size_bytes: number }>("generated_documents", { where: { card_id: id } });
    const items = versions.map((v) => ({
      version: v.version,
      approvedAt: v.approved_at,
      documentId: v.document_id,
      fileName: docs.find((d) => d.id === v.document_id)?.file_name ?? "",
      sizeBytes: docs.find((d) => d.id === v.document_id)?.size_bytes ?? 0,
    }));
    return <ApprovedView cardId={id} patientId={card.patient_id} patientName={docCtx.patient.fullName} versions={items} />;
  }

  const ui = await getUiPrefs(ctx);
  const last = (ui.lastSection as Record<string, string> | undefined)?.[id] ?? null;
  return (
    <CardEditor
      cardId={id}
      patientId={card.patient_id}
      initial={CardData.parse(card.data)}
      updatedAt={card.updated_at}
      docCtx={docCtx}
      lastSection={last}
      versions={card.version}
    />
  );
}
