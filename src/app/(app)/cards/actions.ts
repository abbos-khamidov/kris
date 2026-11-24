"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guard, ok } from "@/lib/action";
import { cloneCardData, newCardData } from "@/lib/card/build";
import { docHash } from "@/lib/card/hash";
import { validateCard } from "@/lib/card/validate";
import { getCtx } from "@/lib/db";
import type { Ctx, UploadPlan } from "@/lib/db/types";
import { pdfFileName } from "@/lib/format";
import { CardData } from "@/lib/schemas/card";
import { AnamnesisInput, type PatientRow } from "@/lib/schemas/patient";
import { logActivity } from "@/lib/services/activity";
import { buildDocContext as docContext, buildSnapshotRefs, type CardRow } from "@/lib/services/cards";
import { getSettings } from "@/lib/services/settings";

async function loadCard(ctx: Ctx, id: string) {
  const card = await ctx.db.get<CardRow>("patient_cards", id);
  if (!card) throw new Error("Карта не найдена");
  return card;
}

export async function createCardAction(patientId: string, basedOnCardId?: string) {
  return guard<{ id: string }>(async () => {
    const ctx = await getCtx();
    const patient = await ctx.db.get<PatientRow>("patients", patientId);
    if (!patient) return { ok: false as const, error: "Пациент не найден" };
    const [anam] = await ctx.db.select("patient_anamnesis", { where: { patient_id: patientId }, limit: 1 });
    const anamnesis = anam ? AnamnesisInput.partial().parse(anam) : null;
    const settings = await getSettings(ctx);
    const [lastConsult] = await ctx.db.select("consultations", { where: { patient_id: patientId }, order: { col: "consulted_at" }, limit: 1 });

    let data: CardData;
    if (basedOnCardId) {
      const prev = await loadCard(ctx, basedOnCardId);
      data = cloneCardData(CardData.parse(prev.data), patient, anamnesis);
    } else {
      data = newCardData(patient, anamnesis, settings);
    }
    const row = await ctx.db.insert("patient_cards", {
      patient_id: patientId,
      consultation_id: lastConsult?.id ?? null,
      title: `Карта · ${new Date().toLocaleDateString("ru-RU")}`,
      status: "draft",
      data,
      version: 0,
      based_on_card_id: basedOnCardId ?? null,
      approved_at: null,
    });
    await logActivity(ctx, "card.create", "card", row.id, { patient_id: patientId, cloned: !!basedOnCardId });
    revalidatePath("/cards");
    revalidatePath(`/patients/${patientId}`);
    return ok({ id: row.id });
  });
}

/** Autosave target. Optimistic concurrency: a stale `ifUpdatedAt` is rejected as a conflict. */
export async function saveCardAction(cardId: string, input: unknown, ifUpdatedAt?: string) {
  return guard<{ updatedAt: string }>(async () => {
    const ctx = await getCtx();
    const card = await loadCard(ctx, cardId);
    if (card.status !== "draft") return { ok: false as const, error: "Карта утверждена. Создайте новую версию, чтобы редактировать." };
    const data = CardData.parse(input);
    const row = await ctx.db.update("patient_cards", cardId, { data }, { ifUpdatedAt });
    return ok({ updatedAt: row.updated_at });
  });
}

export async function startNewVersionAction(cardId: string) {
  return guard(async () => {
    const ctx = await getCtx();
    const card = await loadCard(ctx, cardId);
    if (card.status !== "approved") return { ok: false as const, error: "Карта уже редактируется" };
    await ctx.db.update("patient_cards", cardId, { status: "draft" });
    await logActivity(ctx, "card.new_version", "card", cardId, { patient_id: card.patient_id });
    revalidatePath(`/cards/${cardId}`);
    return ok();
  });
}

export async function deleteDraftAction(cardId: string) {
  return guard(async () => {
    const ctx = await getCtx();
    const card = await loadCard(ctx, cardId);
    if (card.version > 0) return { ok: false as const, error: "Карту с утверждёнными версиями удалить нельзя" };
    await ctx.db.remove("patient_cards", cardId);
    await logActivity(ctx, "card.delete_draft", "card", cardId, { patient_id: card.patient_id });
    revalidatePath("/cards");
    return ok();
  });
}

/* ---------------------------------------------------------------- approval */

export async function prepareApprovalAction(cardId: string) {
  return guard<{ plan: UploadPlan; path: string; hash: string; version: number; fileName: string }>(async () => {
    const ctx = await getCtx();
    const card = await loadCard(ctx, cardId);
    if (card.status !== "draft") return { ok: false as const, error: "Карта уже утверждена" };
    const data = CardData.parse(card.data);
    if (validateCard(data).some((i) => i.severity === "error")) {
      return { ok: false as const, error: "Исправьте ошибки перед утверждением" };
    }
    const hash = await docHash(await docContext(ctx, card.patient_id), data);
    const version = card.version + 1;
    const path = `${ctx.user.id}/documents/${cardId}/v${version}-${randomUUID()}.pdf`;
    const plan = await ctx.storage.createUpload(path);
    return ok({ plan, path, hash, version, fileName: pdfFileName(data.personal.fullName || "пациент") });
  });
}

const Finalize = z.object({
  path: z.string().min(10).max(300),
  hash: z.string().length(64),
  size: z.number().int().positive().max(60_000_000),
  sha256: z.string().length(64),
  fileName: z.string().min(5).max(200),
  /** The specialist ticked "I have reviewed every recommendation". */
  reviewed: z.literal(true, { error: "Подтвердите, что вы проверили назначения" }),
});

export async function finalizeApprovalAction(cardId: string, input: unknown) {
  return guard<{ documentId: string; version: number }>(async () => {
    const ctx = await getCtx();
    const v = Finalize.parse(input);
    const card = await loadCard(ctx, cardId);
    if (card.status !== "draft") return { ok: false as const, error: "Карта уже утверждена" };
    if (!v.path.startsWith(`${ctx.user.id}/documents/${cardId}/`)) return { ok: false as const, error: "Недопустимый путь файла" };

    const data = CardData.parse(card.data);
    if (validateCard(data).some((i) => i.severity === "error")) return { ok: false as const, error: "Исправьте ошибки перед утверждением" };

    // Integrity: the PDF must have been rendered from exactly the data that is stored right now.
    const hash = await docHash(await docContext(ctx, card.patient_id), data);
    if (hash !== v.hash) return { ok: false as const, error: "Данные карты изменились во время утверждения. Повторите.", code: "conflict" as const };
    if (!(await ctx.storage.exists(v.path))) return { ok: false as const, error: "PDF не найден в хранилище" };

    const version = card.version + 1;
    const refs = await buildSnapshotRefs(ctx, { ...card, id: cardId });
    const doc = await ctx.db.insert("generated_documents", {
      card_id: cardId,
      version,
      path: v.path,
      file_name: v.fileName,
      size_bytes: v.size,
      sha256: v.sha256,
    });
    await ctx.db.insert("card_versions", {
      card_id: cardId,
      version,
      snapshot: { ...refs, generatedAt: new Date().toISOString(), docHash: hash },
      document_id: doc.id,
      approved_at: new Date().toISOString(),
    });
    await ctx.db.update("patient_cards", cardId, { status: "approved", version, approved_at: new Date().toISOString() });
    await logActivity(ctx, "card.approve", "card", cardId, { patient_id: card.patient_id, version });
    revalidatePath("/cards");
    revalidatePath(`/cards/${cardId}`);
    revalidatePath(`/patients/${card.patient_id}`);
    return ok({ documentId: doc.id, version });
  });
}

/** The ORIGINAL stored PDF of a version — never regenerated from current data. */
export async function documentUrlAction(documentId: string) {
  return guard<{ url: string; fileName: string }>(async () => {
    const ctx = await getCtx();
    const doc = await ctx.db.get<{ path: string; file_name: string }>("generated_documents", documentId);
    if (!doc) return { ok: false as const, error: "Документ не найден" };
    return ok({ url: await ctx.storage.signedUrl(doc.path, 300), fileName: doc.file_name });
  });
}

/** Rebuilds the personal-data block from the patient profile + latest anamnesis (explicit user action). */
export async function refreshPersonalAction(patientId: string) {
  return guard<import("@/lib/schemas/card").Personal>(async () => {
    const ctx = await getCtx();
    const patient = await ctx.db.get<PatientRow>("patients", patientId);
    if (!patient) return { ok: false as const, error: "Пациент не найден" };
    const [anam] = await ctx.db.select("patient_anamnesis", { where: { patient_id: patientId }, limit: 1 });
    const { personalFromPatient } = await import("@/lib/card/build");
    return ok(personalFromPatient(patient, anam ? AnamnesisInput.partial().parse(anam) : null));
  });
}

/** Cross-device UI state (theme, last open section per card). Never contains medical data. */
export async function saveUiPrefsAction(patch: unknown) {
  return guard(async () => {
    const ctx = await getCtx();
    const { saveUiPrefs } = await import("@/lib/services/settings");
    const p = z.object({ lastSection: z.record(z.string(), z.string()).optional() }).passthrough().parse(patch);
    const { getUiPrefs } = await import("@/lib/services/settings");
    const current = await getUiPrefs(ctx);
    const merged = p.lastSection
      ? { ...p, lastSection: { ...((current.lastSection as Record<string, string> | undefined) ?? {}), ...p.lastSection } }
      : p;
    await saveUiPrefs(ctx, merged);
    return ok();
  });
}
