"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  LOCAL_COOKIE,
  SESSION_MAX_AGE,
  checkLocalCredentials,
  createLocalUser,
  hasLocalUsers,
  signSession,
} from "@/lib/auth/local";
import { createSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

export type AuthState = { error?: string };

const credentials = z.object({
  email: z.string().trim().email("Введите корректный email"),
  password: z.string().min(8, "Пароль — не менее 8 символов").max(200),
});

async function startLocalSession(user: { id: string; email: string }) {
  (await cookies()).set(LOCAL_COOKIE, await signSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function loginAction(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password } = parsed.data;

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "Неверный email или пароль" };
  } else {
    const user = await checkLocalCredentials(email, password);
    if (!user) return { error: "Неверный email или пароль" };
    await startLocalSession(user);
  }
  redirect("/");
}

/** Local demo mode only: creates the first (and only) account. Closed registration afterwards. */
export async function setupAction(_: AuthState, form: FormData): Promise<AuthState> {
  if (isSupabaseConfigured()) return { error: "Регистрация закрыта. Создайте пользователя в панели Supabase." };
  if (await hasLocalUsers()) return { error: "Регистрация закрыта" };
  const parsed = credentials
    .extend({ name: z.string().trim().min(2, "Укажите имя").max(120) })
    .safeParse({
      email: form.get("email"),
      password: form.get("password"),
      name: form.get("name"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const user = await createLocalUser(parsed.data.email, parsed.data.password, parsed.data.name);
  await startLocalSession(user);
  redirect("/");
}

export async function logoutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServer();
    await supabase.auth.signOut();
  } else {
    (await cookies()).delete(LOCAL_COOKIE);
  }
  redirect("/login");
}
