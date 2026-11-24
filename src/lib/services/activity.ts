import "server-only";
import type { Ctx } from "@/lib/db/types";

/** Audit trail. `meta` must never contain medical content or personal data — ids and counters only. */
export async function logActivity(
  ctx: Ctx,
  action: string,
  entity: string,
  entityId?: string,
  meta: Record<string, string | number | boolean | null> = {},
) {
  try {
    await ctx.db.insert("activity_logs", { action, entity, entity_id: entityId ?? null, meta });
  } catch {
    // The audit log must never break the user's action.
  }
}
