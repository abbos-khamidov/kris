import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCtx } from "@/lib/db";
import type { PatientRow } from "@/lib/schemas/patient";
import type { CardRow } from "@/lib/services/cards";
import { QuickCard } from "./quick-card";

export const metadata = { title: "Дашборд" };
export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  "patient.create": "Создан пациент",
  "patient.update": "Изменены данные пациента",
  "patient.archive": "Пациент в архиве",
  "patient.restore": "Пациент возвращён из архива",
  "anamnesis.save": "Сохранён анамнез",
  "consultation.create": "Добавлена консультация",
  "card.create": "Создана карта",
  "card.approve": "Утверждена карта",
  "card.new_version": "Начата новая версия карты",
  "card.delete_draft": "Удалён черновик",
  "media.upload": "Загружено изображение",
  "brand.set": "Заменено фирменное изображение",
  "settings.save": "Сохранены настройки",
};

/** Every figure below is computed from real database rows — no placeholders. */
export default async function Dashboard() {
  const ctx = await getCtx();
  const [patients, cards, consultations, logs] = await Promise.all([
    ctx.db.select<PatientRow>("patients"),
    ctx.db.select<CardRow>("patient_cards"),
    ctx.db.select<{ patient_id: string }>("consultations"),
    ctx.db.select<{ action: string }>("activity_logs", { order: { col: "created_at" }, limit: 8 }),
  ]);
  const active = patients.filter((p) => !p.archived_at);
  const perPatient = new Map<string, number>();
  for (const c of consultations) perPatient.set(c.patient_id, (perPatient.get(c.patient_id) ?? 0) + 1);
  const repeat = [...perPatient.values()].filter((n) => n >= 2).length;

  const stats = [
    { label: "Пациенты", value: active.length, href: "/patients" },
    { label: "Карты", value: cards.length, href: "/cards" },
    { label: "Черновики", value: cards.filter((c) => c.status === "draft").length, href: "/cards?status=draft" },
    { label: "Повторные консультации", value: repeat, hint: "пациентов с 2+ консультациями" },
  ];

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Дашборд</h1>
        <Button nativeButton={false} render={<Link href="/patients/new" />} className="h-11 sm:h-8">
          <Plus /> Новый пациент
        </Button>
      </div>

      <dl className="stagger grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border lg:grid-cols-4">
        {stats.map((s) => {
          const inner = (
            <div className="h-full bg-surface p-4">
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
              <dd className="mt-1 font-serif text-3xl tabular-nums">{s.value}</dd>
              {s.hint && <p className="mt-1 text-[11px] text-muted-foreground">{s.hint}</p>}
            </div>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="block hover:bg-secondary/50">
              {inner}
            </Link>
          ) : (
            <div key={s.label}>{inner}</div>
          );
        })}
      </dl>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg">Быстрая карта</h2>
          <QuickCard patients={active.map((p) => ({ id: p.id, name: p.full_name }))} />
        </section>
        <section className="space-y-3">
          <h2 className="text-lg">Последние действия</h2>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Действий пока нет.</p>
          ) : (
            <ul className="divide-y rounded-md border bg-surface text-sm">
              {logs.map((l) => (
                <li key={l.id} className="flex justify-between gap-4 px-4 py-2.5">
                  <span>{ACTION_LABEL[l.action] ?? l.action}</span>
                  <time className="shrink-0 text-xs text-muted-foreground" dateTime={l.created_at}>
                    {new Date(l.created_at).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
