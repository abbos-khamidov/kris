"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guard, ok } from "@/lib/action";
import { getCtx } from "@/lib/db";
import { ANGLES, STAGES } from "@/lib/photos";
import { logActivity } from "@/lib/services/activity";


export interface PatientPhoto {
  id: string;
  assetId: string;
  takenAt: string;
  stage: (typeof STAGES)[number];
  angle: (typeof ANGLES)[number];
  comment: string;
  allowInPdf: boolean;
  consultationId: string | null;
  url: string;
  uploadedAt: string;
}

interface Row {
  patient_id: string;
  consultation_id: string | null;
  asset_id: string;
  taken_at: string;
  stage: (typeof STAGES)[number];
  angle: (typeof ANGLES)[number];
  comment: string;
  allow_in_pdf: boolean;
}

/** Patient photos are private by default; only photos the specialist ticks are offered for the PDF. */
export async function listPatientPhotosAction(patientId: string) {
  return guard<PatientPhoto[]>(async () => {
    const ctx = await getCtx();
    const rows = await ctx.db.select<Row>("patient_photos", { where: { patient_id: patientId }, order: { col: "taken_at" } });
    const out: PatientPhoto[] = [];
    for (const r of rows) {
      const a = await ctx.db.get<{ path: string; archived_at: string | null }>("media_assets", r.asset_id);
      if (!a || a.archived_at) continue;
      out.push({
        id: r.id,
        assetId: r.asset_id,
        takenAt: r.taken_at,
        stage: r.stage,
        angle: r.angle,
        comment: r.comment,
        allowInPdf: r.allow_in_pdf,
        consultationId: r.consultation_id,
        url: await ctx.storage.signedUrl(a.path, 900),
        uploadedAt: r.created_at,
      });
    }
    return ok(out);
  });
}

const Meta = z.object({
  takenAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  stage: z.enum(STAGES),
  angle: z.enum(ANGLES),
  comment: z.string().max(1000).default(""),
  allowInPdf: z.boolean().default(false),
  consultationId: z.string().nullable().default(null),
});

export async function addPatientPhotoAction(patientId: string, assetId: string, meta: unknown) {
  return guard<{ id: string }>(async () => {
    const ctx = await getCtx();
    if (!(await ctx.db.get("patients", patientId))) return { ok: false as const, error: "Пациент не найден" };
    const asset = await ctx.db.get("media_assets", assetId);
    if (!asset) return { ok: false as const, error: "Изображение не найдено" };
    const m = Meta.parse(meta);
    const row = await ctx.db.insert("patient_photos", {
      patient_id: patientId,
      consultation_id: m.consultationId,
      asset_id: assetId,
      taken_at: m.takenAt,
      stage: m.stage,
      angle: m.angle,
      comment: m.comment,
      allow_in_pdf: m.allowInPdf,
      sort: 0,
    });
    await logActivity(ctx, "photo.add", "patient", patientId, { patient_id: patientId });
    revalidatePath(`/patients/${patientId}`);
    return ok({ id: row.id });
  });
}

export async function updatePatientPhotoAction(photoId: string, patientId: string, meta: unknown) {
  return guard(async () => {
    const ctx = await getCtx();
    const m = Meta.partial().parse(meta);
    const values: Record<string, unknown> = {};
    if (m.takenAt !== undefined) values.taken_at = m.takenAt;
    if (m.stage !== undefined) values.stage = m.stage;
    if (m.angle !== undefined) values.angle = m.angle;
    if (m.comment !== undefined) values.comment = m.comment;
    if (m.allowInPdf !== undefined) values.allow_in_pdf = m.allowInPdf;
    await ctx.db.update("patient_photos", photoId, values);
    revalidatePath(`/patients/${patientId}`);
    return ok();
  });
}

/** Deleting hides the photo; the file is archived, so any approved PDF that used it is unaffected. */
export async function deletePatientPhotoAction(photoId: string, patientId: string) {
  return guard(async () => {
    const ctx = await getCtx();
    const r = await ctx.db.get<Row>("patient_photos", photoId);
    if (!r) return { ok: false as const, error: "Фото не найдено" };
    await ctx.db.remove("patient_photos", photoId);
    await ctx.db.update("media_assets", r.asset_id, { archived_at: new Date().toISOString() });
    await logActivity(ctx, "photo.delete", "patient", patientId, { patient_id: patientId });
    revalidatePath(`/patients/${patientId}`);
    return ok();
  });
}
