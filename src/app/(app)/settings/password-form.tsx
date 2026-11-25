"use client";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/fields";
import { changePasswordAction } from "./security-actions";

export function PasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  return (
    <section className="space-y-4 rounded-md border bg-surface p-5">
      <div>
        <h2 className="text-lg">Безопасность</h2>
        <p className="text-sm text-muted-foreground">Задайте свой пароль для входа. Чем он длиннее, тем лучше: в кабинете хранятся медицинские данные.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Новый пароль" htmlFor="pw-new">
          <Input id="pw-new" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 sm:h-8" />
        </Field>
        <Field label="Повторите пароль" htmlFor="pw-confirm">
          <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11 sm:h-8" />
        </Field>
      </div>
      <Button
        type="button"
        className="h-11 sm:h-8"
        disabled={pending || password.length < 8}
        onClick={() =>
          start(async () => {
            const r = await changePasswordAction({ password, confirm });
            if (!r.ok) return void toast.error(r.error);
            toast.success("Пароль изменён");
            setPassword("");
            setConfirm("");
          })
        }
      >
        {pending && <Loader2 className="animate-spin" />} Сменить пароль
      </Button>
    </section>
  );
}
