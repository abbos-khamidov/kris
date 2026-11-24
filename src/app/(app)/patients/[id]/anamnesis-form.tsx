"use client";
import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Segmented, TriField } from "@/components/fields";
import { SaveBadge } from "@/components/save-badge";
import { VoiceInput } from "@/components/voice-input";
import { useAutosave } from "@/hooks/use-autosave";
import { SaveError } from "@/lib/autosave";
import { CYCLE, PREGNANCY } from "@/lib/schemas/card";
import { uid } from "@/lib/schemas/common";
import type { AnamnesisInput } from "@/lib/schemas/patient";
import { saveAnamnesisAction } from "../actions";

const CYCLE_LABEL: Record<(typeof CYCLE)[number], string> = {
  regular: "Регулярный",
  irregular: "Нерегулярный",
  unknown: "Неизвестно",
  unspecified: "Не указано",
};
const PREGNANCY_LABEL: Record<(typeof PREGNANCY)[number], string> = {
  yes: "Да",
  no: "Нет",
  planning: "Планирование",
  unknown: "Неизвестно",
  unspecified: "Не указано",
};
const SEBUM = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const SEBUM_HINT: Record<number, string> = {
  1: "Себостатическая (себодефицитная)",
  2: "Скорее себостатическая, умеренно (склонна к сухости)",
  3: "Кожа с нормальным (умеренным) типом сальной секреции",
  4: "Скорее себорейная, умеренно (склонна к жирности)",
  5: "Себорейная",
};

export function AnamnesisForm({ patientId, initial, updatedAt }: { patientId: string; initial: AnamnesisInput; updatedAt: string | null }) {
  const [data, setData] = useState<AnamnesisInput>(initial);
  const token = useRef<string | undefined>(updatedAt ?? undefined);

  const autosave = useAutosave<AnamnesisInput>(async (value) => {
    let res;
    try {
      res = await saveAnamnesisAction(patientId, value, token.current);
    } catch {
      throw new SaveError("network");
    }
    if (!res.ok) throw new SaveError(res.code === "conflict" ? "conflict" : "server", res.error);
    token.current = (res.data as { updatedAt: string }).updatedAt;
  });

  const set = <K extends keyof AnamnesisInput>(key: K, value: AnamnesisInput[K]) => {
    const next = { ...data, [key]: value };
    setData(next);
    autosave.update(next);
  };

  const setCustom = (i: number, patch: Partial<AnamnesisInput["custom_fields"][number]>) =>
    set("custom_fields", data.custom_fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  return (
    <div className="space-y-6">
      <div className="sticky top-14 z-10 -mx-1 flex min-h-8 items-center justify-end bg-background px-1 py-1 lg:top-0">
        <SaveBadge
          status={autosave.status}
          message={autosave.message}
          onRetry={autosave.retry}
          onConflict={() => {
            toast.info("Страница будет обновлена");
            window.location.reload();
          }}
        />
      </div>

      <section className="space-y-5 rounded-md border bg-surface p-5">
        <h2 className="text-lg">Медицинские сведения</h2>
        <p className="-mt-2 text-xs text-muted-foreground">
          Значение «Не указано» остаётся, пока вы не выберете ответ. Приложение никогда не подставляет «Нет» само.
        </p>

        <Field label="Аллергии">
          <TriField label="Аллергии" value={data.allergies_state} onChange={(v) => set("allergies_state", v)} />
          <VoiceInput multiline={false} value={data.allergies} onChange={(v) => set("allergies", v)} placeholder="Уточнение" aria-label="Аллергии: уточнение" />
        </Field>
        <Field label="Хронические заболевания">
          <TriField label="Хронические заболевания" value={data.chronic_state} onChange={(v) => set("chronic_state", v)} />
          <VoiceInput multiline={false} value={data.chronic} onChange={(v) => set("chronic", v)} placeholder="Уточнение" aria-label="Хронические заболевания: уточнение" />
        </Field>
        <Field label="Состояние щитовидной железы">
          <TriField label="Щитовидная железа" value={data.thyroid_state} onChange={(v) => set("thyroid_state", v)} />
          <VoiceInput multiline={false} value={data.thyroid} onChange={(v) => set("thyroid", v)} placeholder="Уточнение" aria-label="Щитовидная железа: уточнение" />
        </Field>
        <Field label="Анализы на гормоны">
          <TriField label="Анализы на гормоны" value={data.hormone_tests} onChange={(v) => set("hormone_tests", v)} />
          <VoiceInput multiline={false} value={data.hormone_tests_note} onChange={(v) => set("hormone_tests_note", v)} placeholder="Результаты, даты" aria-label="Анализы на гормоны: заметка" />
        </Field>
        <Field label="Менструальный цикл">
          <Segmented
            label="Цикл"
            value={data.cycle}
            onChange={(v) => set("cycle", v)}
            options={CYCLE.map((v) => ({ value: v, label: CYCLE_LABEL[v] }))}
          />
        </Field>
        <Field label="Беременность">
          <Segmented
            label="Беременность"
            value={data.pregnancy}
            onChange={(v) => set("pregnancy", v)}
            options={PREGNANCY.map((v) => ({ value: v, label: PREGNANCY_LABEL[v] }))}
          />
        </Field>
        <Field label="Лактация">
          <TriField label="Лактация" value={data.lactation} onChange={(v) => set("lactation", v)} />
        </Field>
        <Field label="Тип себосекреции" hint={data.sebum ? SEBUM_HINT[Math.round(data.sebum)] : "Шкала 1–5, допускаются промежуточные значения"}>
          <Segmented
            label="Себосекреция"
            value={data.sebum}
            onChange={(v) => set("sebum", v)}
            options={SEBUM.map((v) => ({ value: v, label: String(v).replace(".", ",") }))}
          />
          {data.sebum !== null && (
            <Button type="button" variant="ghost" size="xs" className="ml-1 text-muted-foreground" onClick={() => set("sebum", null)}>
              Сбросить
            </Button>
          )}
        </Field>
      </section>

      <section className="space-y-5 rounded-md border bg-surface p-5">
        <h2 className="text-lg">Состояние и жалобы</h2>
        <Field label="Состояние кожи">
          <VoiceInput value={data.skin_state} onChange={(v) => set("skin_state", v)} rows={4} aria-label="Состояние кожи" />
        </Field>
        <Field label="Жалобы">
          <VoiceInput value={data.complaints} onChange={(v) => set("complaints", v)} rows={4} aria-label="Жалобы" />
        </Field>
        <Field label="Комментарии">
          <VoiceInput value={data.comments} onChange={(v) => set("comments", v)} rows={3} aria-label="Индивидуальные комментарии" />
        </Field>
      </section>

      <section className="space-y-4 rounded-md border bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg">Индивидуальные поля</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => set("custom_fields", [...data.custom_fields, { id: uid(), label: "", value: "" }])}
          >
            <Plus /> Добавить поле
          </Button>
        </div>
        {data.custom_fields.length === 0 && <p className="text-sm text-muted-foreground">Например: «Курение», «Приём препаратов».</p>}
        {data.custom_fields.map((f, i) => (
          <div key={f.id} className="grid grid-cols-[1fr_auto] items-start gap-2 sm:grid-cols-[200px_1fr_auto]">
            <Input value={f.label} onChange={(e) => setCustom(i, { label: e.target.value })} placeholder="Название" aria-label="Название поля" className="h-11 sm:h-8" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 sm:order-3 sm:size-8"
              aria-label="Удалить поле"
              onClick={() => set("custom_fields", data.custom_fields.filter((_, idx) => idx !== i))}
            >
              <Trash2 />
            </Button>
            <div className="col-span-2 sm:col-span-1 sm:order-2">
              <VoiceInput multiline={false} value={f.value} onChange={(v) => setCustom(i, { value: v })} placeholder="Значение" aria-label="Значение поля" />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
