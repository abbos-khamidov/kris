import { ConflictError } from "@/lib/db/types";
import { ZodError } from "zod";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: "conflict" | "invalid" | "server" };

export const ok = <T = undefined>(data?: T): ActionResult<T> => ({ ok: true, data: data as T });

/** Runs a server action body and converts known failures to typed results (never leaks internals). */
export async function guard<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ConflictError) return { ok: false, error: e.message, code: "conflict" };
    if (e instanceof ZodError) return { ok: false, error: e.issues[0]?.message ?? "Проверьте введённые данные", code: "invalid" };
    // Next.js control-flow errors (redirect/notFound) must pass through.
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error("[action]", e instanceof Error ? e.message : "unknown error");
    return { ok: false, error: "Ошибка сервера. Повторите попытку.", code: "server" };
  }
}
