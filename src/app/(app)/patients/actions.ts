"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { guard, ok, type ActionResult } from "@/lib/action";
import { getCtx } from "@/lib/db";
import { logActivity } from "@/lib/services/activity";
import { AnamnesisInput, ConsultationInput, PatientInput } from "@/lib/schemas/patient";

export async function createPatientAction(_: ActionResult | null, form: FormData): Promise<ActionResult | null> {
  const ctx = await getCtx();
  const parsed = PatientInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message, code: "invalid" };
  let id: string;
  try {
    const row = await ctx.db.insert("patients", parsed.data);
    id = row.id;
    await logActivity(ctx, "patient.create", "patient", id);
  } catch {
    return { ok: false, error: "Не удалось создать пациента", code: "server" };
  }
  revalidatePath("/patients");
  redirect(`/patients/${id}`);
}

export async function updatePatientAction(id: string, input: unknown, ifUpdatedAt?: string) {
  return guard(async () => {
    const ctx = await getCtx();
    const data = PatientInput.parse(input);
    const row = await ctx.db.update("patients", id, data, { ifUpdatedAt });
    await logActivity(ctx, "patient.update", "patient", id);
    revalidatePath(`/patients/${id}`);
    return ok({ updatedAt: row.updated_at });
  });
}

export async function setPatientArchivedAction(id: string, archived: boolean) {
  return guard(async () => {
    const ctx = await getCtx();
    await ctx.db.update("patients", id, { archived_at: archived ? new Date().toISOString() : null });
    await logActivity(ctx, archived ? "patient.archive" : "patient.restore", "patient", id);
    revalidatePath("/patients");
    revalidatePath(`/patients/${id}`);
    return ok();
  });
}

export async function saveAnamnesisAction(patientId: string, input: unknown, ifUpdatedAt?: string) {
  return guard(async () => {
    const ctx = await getCtx();
    const patient = await ctx.db.get("patients", patientId);
    if (!patient) return { ok: false as const, error: "Пациент не найден" };
    const data = AnamnesisInput.parse(input);
    const [existing] = await ctx.db.select("patient_anamnesis", { where: { patient_id: patientId }, limit: 1 });
    const row = existing
      ? await ctx.db.update("patient_anamnesis", existing.id, data, { ifUpdatedAt })
      : await ctx.db.insert("patient_anamnesis", { ...data, patient_id: patientId });
    await logActivity(ctx, "anamnesis.save", "patient", patientId);
    return ok({ updatedAt: row.updated_at });
  });
}

/** A consultation stores its own copy of the anamnesis at that moment; later edits never rewrite it. */
export async function createConsultationAction(patientId: string, input: unknown) {
  return guard(async () => {
    const ctx = await getCtx();
    const patient = await ctx.db.get("patients", patientId);
    if (!patient) return { ok: false as const, error: "Пациент не найден" };
    const data = ConsultationInput.parse(input);
    const [anamnesis] = await ctx.db.select("patient_anamnesis", { where: { patient_id: patientId }, limit: 1 });
    const row = await ctx.db.insert("consultations", { ...data, patient_id: patientId, anamnesis_snapshot: anamnesis ?? {} });
    await logActivity(ctx, "consultation.create", "consultation", row.id, { patient_id: patientId });
    revalidatePath(`/patients/${patientId}`);
    return ok({ id: row.id });
  });
}
