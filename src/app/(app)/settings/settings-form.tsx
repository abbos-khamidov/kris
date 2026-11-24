"use client";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Segmented } from "@/components/fields";
import { COVER_VARIANTS, COVER_VARIANT_LABEL, TITLE_COLORS } from "@/lib/schemas/card";
import type { Settings } from "@/lib/schemas/settings";
import { saveSettingsAction } from "./actions";

const COLOR_LABEL = { white: "Белый", burgundy: "Бордовый", dark: "Тёмный" } as const;

export function SettingsForm({ initial }: { initial: Settings }) {
  const [s, setS] = useState(initial);
  const [pending, start] = useTransition();
  const sp = (k: keyof Settings["specialist"], v: string) => setS({ ...s, specialist: { ...s.specialist, [k]: v } });
  const pdf = <K extends keyof Settings["pdf"]>(k: K, v: Settings["pdf"][K]) => setS({ ...s, pdf: { ...s.pdf, [k]: v } });

  const save = () =>
    start(async () => {
      const res = await saveSettingsAction({ specialist: s.specialist, sideText: s.sideText, pdf: s.pdf });
      if (res.ok) toast.success("Настройки сохранены");
      else toast.error(res.error);
    });

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-md border bg-surface p-5">
        <h2 className="text-lg">Специалист и контакты</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Имя" htmlFor="s-name">
            <Input id="s-name" value={s.specialist.name} onChange={(e) => sp("name", e.target.value)} className="h-11 sm:h-8" />
          </Field>
          <Field label="Должность" htmlFor="s-title">
            <Input id="s-title" value={s.specialist.title} onChange={(e) => sp("title", e.target.value)} className="h-11 sm:h-8" />
          </Field>
          <Field label="Телефон" htmlFor="s-phone">
            <Input id="s-phone" type="tel" value={s.specialist.phone} onChange={(e) => sp("phone", e.target.value)} className="h-11 sm:h-8" />
          </Field>
          <Field label="WhatsApp (номер или ссылка)" htmlFor="s-wa">
            <Input id="s-wa" value={s.specialist.whatsapp} onChange={(e) => sp("whatsapp", e.target.value)} className="h-11 sm:h-8" />
          </Field>
          <Field label="Telegram (@ник или ссылка)" htmlFor="s-tg">
            <Input id="s-tg" value={s.specialist.telegram} onChange={(e) => sp("telegram", e.target.value)} className="h-11 sm:h-8" />
          </Field>
          <Field label="Instagram" htmlFor="s-ig">
            <Input id="s-ig" value={s.specialist.instagram} onChange={(e) => sp("instagram", e.target.value)} className="h-11 sm:h-8" />
          </Field>
          <Field label="Сайт" htmlFor="s-web" className="sm:col-span-2">
            <Input id="s-web" value={s.specialist.website} onChange={(e) => sp("website", e.target.value)} className="h-11 sm:h-8" />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          Кнопка «Связаться со мной» в PDF ведёт в Telegram, при его отсутствии — в WhatsApp, затем на телефон.
        </p>
      </section>

      <section className="space-y-4 rounded-md border bg-surface p-5">
        <h2 className="text-lg">Оформление PDF по умолчанию</h2>
        <Field label="Вертикальная фирменная надпись" htmlFor="s-side" hint="Показывается вдоль левого края страниц. Оставьте пустым, чтобы скрыть.">
          <Input id="s-side" value={s.sideText} onChange={(e) => setS({ ...s, sideText: e.target.value })} placeholder="@ваш_аккаунт" className="h-11 sm:h-8" />
        </Field>
        <Field label="Вариант обложки">
          <Segmented
            label="Вариант обложки"
            value={s.pdf.coverVariant}
            onChange={(v) => pdf("coverVariant", v)}
            options={COVER_VARIANTS.map((v) => ({ value: v, label: COVER_VARIANT_LABEL[v] }))}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Цвет заголовка обложки">
            <Segmented label="Цвет заголовка" value={s.pdf.coverTitleColor} onChange={(v) => pdf("coverTitleColor", v)} options={TITLE_COLORS.map((v) => ({ value: v, label: COLOR_LABEL[v] }))} />
          </Field>
          <Field label="Цвет ФИО на обложке">
            <Segmented label="Цвет ФИО" value={s.pdf.coverNameColor} onChange={(v) => pdf("coverNameColor", v)} options={TITLE_COLORS.map((v) => ({ value: v, label: COLOR_LABEL[v] }))} />
          </Field>
        </div>
        <Field label="Текст кнопки" htmlFor="s-btn">
          <Input id="s-btn" value={s.pdf.buttonLabel} onChange={(e) => pdf("buttonLabel", e.target.value)} className="h-11 sm:h-8" />
        </Field>
        <p className="text-xs text-muted-foreground">Оформление PDF не зависит от цветовой темы сайта и экрана устройства.</p>
      </section>

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={pending} className="h-11 sm:h-8">
          {pending && <Loader2 className="animate-spin" />}
          Сохранить настройки
        </Button>
      </div>
    </div>
  );
}
