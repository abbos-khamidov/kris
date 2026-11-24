import "server-only";
import type { Ctx } from "@/lib/db/types";
import { Settings } from "@/lib/schemas/settings";

const KEY = "main";

export async function getSettings(ctx: Ctx): Promise<Settings> {
  const [row] = await ctx.db.select("settings", { where: { key: KEY }, limit: 1 });
  return Settings.parse((row?.value as object | undefined) ?? {});
}

export async function saveSettings(ctx: Ctx, value: Settings): Promise<Settings> {
  const parsed = Settings.parse(value);
  const [row] = await ctx.db.select("settings", { where: { key: KEY }, limit: 1 });
  if (row) await ctx.db.update("settings", row.id, { value: parsed });
  else await ctx.db.insert("settings", { key: KEY, value: parsed });
  return parsed;
}

/** Per-user UI preferences (theme, last open card section) — synced across devices. */
export async function getUiPrefs(ctx: Ctx): Promise<Record<string, unknown>> {
  const [row] = await ctx.db.select("settings", { where: { key: "ui" }, limit: 1 });
  return (row?.value as Record<string, unknown> | undefined) ?? {};
}

export async function saveUiPrefs(ctx: Ctx, patch: Record<string, unknown>) {
  const [row] = await ctx.db.select("settings", { where: { key: "ui" }, limit: 1 });
  const next = { ...((row?.value as object | undefined) ?? {}), ...patch };
  if (row) await ctx.db.update("settings", row.id, { value: next });
  else await ctx.db.insert("settings", { key: "ui", value: next });
  return next;
}
