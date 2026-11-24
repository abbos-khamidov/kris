"use client";
import { useActionState, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/fields";
import { VoiceInput } from "@/components/voice-input";
import type { ActionResult } from "@/lib/action";
import type { PatientInput } from "@/lib/schemas/patient";
import { createPatientAction, updatePatientAction } from "./actions";

type Props = { mode: "create" } | { mode: "edit"; id: string; initial: PatientInput; updatedAt: string };

export function PatientForm(props: Props) {
  const [createState, createAction, creating] = useActionState<ActionResult | null, FormData>(createPatientAction, null);
  const [notes, setNotes] = useState(props.mode === "edit" ? props.initial.notes : "");
  const [token, setToken] = useState(props.mode === "edit" ? props.updatedAt : "");
  const [saving, startSave] = useTransition();
  const init = props.mode === "edit" ? props.initial : null;

  const onEditSubmit = (form: FormData) => {
    if (props.mode !== "edit") return;
    startSave(async () => {
      const res = await updatePatientAction(props.id, Object.fromEntries(form), token);
      if (res.ok) {
        setToken((res.data as { updatedAt: string }).updatedAt);
        toast.success("Сохранено");
      } else {
        toast.error(res.code === "conflict" ? "Карточка изменена на другом устройстве. Обновите страницу." : res.error);
      }
    });
  };

  const error = props.mode === "create" && createState && !createState.ok ? createState.error : null;

  return (
    <form action={props.mode === "create" ? createAction : onEditSubmit} className="space-y-5 rounded-md border bg-surface p-5">
      <Field label="ФИО *" htmlFor="f-name">
        <Input id="f-name" name="full_name" defaultValue={init?.full_name} required minLength={2} maxLength={160} autoComplete="off" className="h-11 sm:h-8" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Дата рождения" htmlFor="f-birth">
          <Input id="f-birth" name="birth_date" type="date" defaultValue={init?.birth_date ?? ""} className="h-11 sm:h-8" />
        </Field>
        <Field label="Телефон" htmlFor="f-phone">
          <Input id="f-phone" name="phone" type="tel" defaultValue={init?.phone} autoComplete="off" className="h-11 sm:h-8" />
        </Field>
        <Field label="WhatsApp" htmlFor="f-wa">
          <Input id="f-wa" name="whatsapp" defaultValue={init?.whatsapp} className="h-11 sm:h-8" />
        </Field>
        <Field label="Telegram" htmlFor="f-tg">
          <Input id="f-tg" name="telegram" defaultValue={init?.telegram} className="h-11 sm:h-8" />
        </Field>
        <Field label="Email" htmlFor="f-email" className="sm:col-span-2">
          <Input id="f-email" name="email" type="email" defaultValue={init?.email} className="h-11 sm:h-8" />
        </Field>
      </div>
      <Field label="Заметки">
        <VoiceInput value={notes} onChange={setNotes} rows={4} aria-label="Заметки" />
        <input type="hidden" name="notes" value={notes} />
      </Field>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={creating || saving} className="h-11 sm:h-8">
          {(creating || saving) && <Loader2 className="animate-spin" />}
          {props.mode === "create" ? "Создать пациента" : "Сохранить"}
        </Button>
      </div>
    </form>
  );
}
