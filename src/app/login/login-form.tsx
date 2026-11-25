"use client";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, setupAction, type AuthState } from "./actions";

export function LoginForm({ mode, supabase }: { mode: "login" | "setup"; supabase: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    mode === "setup" ? setupAction : loginAction,
    {},
  );
  return (
    <form action={action} className="space-y-4 rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-border">
      {mode === "setup" && (
        <div className="space-y-1.5">
          <Label htmlFor="name">Имя</Label>
          <Input id="name" name="name" autoComplete="name" required />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">{mode === "setup" ? "Email" : "Логин или email"}</Label>
        <Input id="email" name="email" type={mode === "setup" ? "email" : "text"} autoComplete="username" autoCapitalize="none" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Пароль</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "setup" ? "new-password" : "current-password"}
          minLength={mode === "setup" ? 8 : undefined}
          required
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {mode === "setup" ? "Создать учётную запись" : "Войти"}
      </Button>
    </form>
  );
}
