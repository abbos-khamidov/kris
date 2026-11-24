import { hasLocalUsers } from "@/lib/auth/local";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata = { title: "Вход" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = isSupabaseConfigured();
  const needsSetup = !supabase && !(await hasLocalUsers());
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="animate-fade-in w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl tracking-[0.18em] text-primary">KRIS SKIN</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {needsSetup ? "Первичная настройка: создайте учётную запись косметолога" : "Рабочее пространство косметолога"}
          </p>
        </div>
        <LoginForm mode={needsSetup ? "setup" : "login"} />
        {!supabase && (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Демо-режим: данные хранятся локально. Для боевого режима подключите Supabase (см. README).
          </p>
        )}
      </div>
    </main>
  );
}
