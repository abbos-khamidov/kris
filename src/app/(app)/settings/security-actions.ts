"use server";
import { z } from "zod";
import { guard, ok } from "@/lib/action";
import { setLocalPassword } from "@/lib/auth/local";
import { getCtx } from "@/lib/db";
import { createSupabaseServer } from "@/lib/supabase/server";
import { logActivity } from "@/lib/services/activity";

const Input = z.object({
  password: z.string().min(8, "Пароль — не менее 8 символов").max(72, "Пароль слишком длинный"),
  confirm: z.string(),
});

/** Lets the owner choose their own password (Supabase Auth in production, scrypt hash in local demo). */
export async function changePasswordAction(input: unknown) {
  return guard(async () => {
    const ctx = await getCtx();
    const v = Input.parse(input);
    if (v.password !== v.confirm) return { ok: false as const, error: "Пароли не совпадают" };
    if (ctx.mode === "supabase") {
      const supabase = await createSupabaseServer();
      const { error } = await supabase.auth.updateUser({ password: v.password });
      if (error) return { ok: false as const, error: error.message.includes("same") ? "Новый пароль совпадает с текущим" : "Не удалось сменить пароль" };
    } else {
      await setLocalPassword(ctx.user.id, v.password);
    }
    await logActivity(ctx, "security.password_change", "profile", ctx.user.id);
    return ok();
  });
}
