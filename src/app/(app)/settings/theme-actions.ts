"use server";
import { z } from "zod";
import { guard, ok } from "@/lib/action";
import { getCtx } from "@/lib/db";
import { getUiPrefs, saveUiPrefs } from "@/lib/services/settings";
import { DEFAULT_PREFS, PALETTES, type ThemePrefs } from "@/lib/theme";

const Theme = z.object({
  palette: z.enum([...(Object.keys(PALETTES) as [keyof typeof PALETTES]), "custom"]),
  custom: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  mode: z.enum(["light", "dark", "system"]),
});

/** Theme is a per-user UI preference stored in Supabase, so it follows the user across devices. */
export async function saveThemeAction(input: unknown) {
  return guard(async () => {
    const ctx = await getCtx();
    await saveUiPrefs(ctx, { theme: Theme.parse(input) });
    return ok();
  });
}

export async function loadThemeAction() {
  return guard<ThemePrefs>(async () => {
    const ctx = await getCtx();
    const stored = (await getUiPrefs(ctx)).theme;
    const parsed = Theme.safeParse(stored);
    return ok(parsed.success ? (parsed.data as ThemePrefs) : DEFAULT_PREFS);
  });
}
