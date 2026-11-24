"use server";
import { revalidatePath } from "next/cache";
import { guard, ok } from "@/lib/action";
import { getCtx } from "@/lib/db";
import { Settings } from "@/lib/schemas/settings";
import { logActivity } from "@/lib/services/activity";
import { getSettings, saveSettings } from "@/lib/services/settings";

/** Changing settings never touches approved documents: they hold their own frozen snapshot. */
export async function saveSettingsAction(patch: unknown) {
  return guard(async () => {
    const ctx = await getCtx();
    const current = await getSettings(ctx);
    const incoming = patch as Partial<Settings>;
    const merged = Settings.parse({
      ...current,
      ...incoming,
      specialist: { ...current.specialist, ...(incoming.specialist ?? {}) },
      pdf: { ...current.pdf, ...(incoming.pdf ?? {}) },
      brandImages: current.brandImages,
    });
    await saveSettings(ctx, merged);
    await logActivity(ctx, "settings.save", "settings");
    revalidatePath("/settings");
    return ok();
  });
}
