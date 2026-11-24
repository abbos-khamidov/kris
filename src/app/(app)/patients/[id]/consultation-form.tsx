"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/fields";
import { VoiceInput } from "@/components/voice-input";
import { createConsultationAction } from "../actions";

export function ConsultationForm({ patientId, today }: { patientId: string; today: string }) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [complaints, setComplaints] = useState("");
  const [skin, setSkin] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const res = await createConsultationAction(patientId, { consulted_at: date, complaints, skin_state: skin, notes });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Консультация сохранена");
      setComplaints("");
      setSkin("");
      setNotes("");
      router.refresh();
    });

  return (
    <div className="space-y-4 rounded-md border bg-surface p-5">
      <h2 className="text-lg">Новая консультация</h2>
      <p className="-mt-2 text-xs text-muted-foreground">
        В консультацию автоматически сохраняется копия текущего анамнеза. Прошлые консультации не изменяются.
      </p>
      <Field label="Дата" htmlFor="c-date">
        <Input id="c-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 w-full sm:h-8 sm:w-48" />
      </Field>
      <Field label="Жалобы">
        <VoiceInput value={complaints} onChange={setComplaints} rows={3} aria-label="Жалобы" />
      </Field>
      <Field label="Состояние кожи">
        <VoiceInput value={skin} onChange={setSkin} rows={3} aria-label="Состояние кожи" />
      </Field>
      <Field label="Заметки">
        <VoiceInput value={notes} onChange={setNotes} rows={3} aria-label="Заметки консультации" />
      </Field>
      <div className="flex justify-end">
        <Button type="button" onClick={submit} disabled={pending || !date} className="h-11 sm:h-8">
          {pending && <Loader2 className="animate-spin" />}
          Сохранить консультацию
        </Button>
      </div>
    </div>
  );
}
