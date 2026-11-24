import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveButton } from "./archive-button";
import { AnamnesisForm } from "./anamnesis-form";
import { ConsultationForm } from "./consultation-form";
import { NewCardButtons } from "./new-card-buttons";
import type { CardRow } from "@/lib/services/cards";
import { PatientForm } from "../patient-form";
import { getCtx } from "@/lib/db";
import { ageFromBirthDate, formatDateRu, pluralYears } from "@/lib/format";
import { AnamnesisInput, type PatientRow } from "@/lib/schemas/patient";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "info", label: "Общая информация" },
  { key: "anamnesis", label: "Анамнез" },
  { key: "consultations", label: "Консультации" },
  { key: "cards", label: "Карты пациента" },
  { key: "history", label: "История изменений" },
] as const;

const ACTION_LABEL: Record<string, string> = {
  "patient.create": "Пациент создан",
  "patient.update": "Данные пациента изменены",
  "patient.archive": "Пациент перенесён в архив",
  "patient.restore": "Пациент возвращён из архива",
  "anamnesis.save": "Анамнез сохранён",
  "consultation.create": "Консультация добавлена",
  "card.create": "Карта создана",
  "card.approve": "Карта утверждена",
};

export default async function PatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "info" } = await searchParams;
  const ctx = await getCtx();
  const patient = await ctx.db.get<PatientRow>("patients", id);
  if (!patient) notFound();
  const age = ageFromBirthDate(patient.birth_date);
  const active = TABS.some((t) => t.key === tab) ? tab : "info";

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/patients" className="text-xs text-muted-foreground hover:text-primary">
            ← Все пациенты
          </Link>
          <h1 className="mt-1 break-words text-2xl">{patient.full_name}</h1>
          <p className="text-sm text-muted-foreground">
            {[age != null ? `${age} ${pluralYears(age)}` : null, patient.phone || null, patient.archived_at ? "в архиве" : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <ArchiveButton id={id} archived={!!patient.archived_at} />
      </div>

      <nav className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 lg:mx-0 lg:px-0" aria-label="Разделы профиля">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/patients/${id}?tab=${t.key}`}
            aria-current={active === t.key ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-3 text-sm sm:py-2.5",
              active === t.key ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {active === "info" && (
        <PatientForm
          mode="edit"
          id={id}
          updatedAt={patient.updated_at}
          initial={{
            full_name: patient.full_name,
            birth_date: patient.birth_date ?? null,
            phone: patient.phone,
            whatsapp: patient.whatsapp,
            telegram: patient.telegram,
            email: patient.email,
            notes: patient.notes,
          }}
        />
      )}
      {active === "anamnesis" && <AnamnesisTab id={id} />}
      {active === "consultations" && <ConsultationsTab id={id} />}
      {active === "cards" && <CardsTab id={id} />}
      {active === "history" && <HistoryTab id={id} />}
    </div>
  );
}

async function AnamnesisTab({ id }: { id: string }) {
  const ctx = await getCtx();
  const [row] = await ctx.db.select("patient_anamnesis", { where: { patient_id: id }, limit: 1 });
  const initial = AnamnesisInput.parse(row ?? {});
  return <AnamnesisForm patientId={id} initial={initial} updatedAt={row?.updated_at ?? null} />;
}

async function ConsultationsTab({ id }: { id: string }) {
  const ctx = await getCtx();
  const list = await ctx.db.select<{ consulted_at: string; complaints: string; skin_state: string; notes: string }>("consultations", {
    where: { patient_id: id },
    order: { col: "consulted_at" },
  });
  return (
    <div className="space-y-6">
      <ConsultationForm patientId={id} today={new Date().toISOString().slice(0, 10)} />
      <section className="space-y-3">
        <h2 className="text-lg">Предыдущие консультации</h2>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Консультаций пока нет.</p>
        ) : (
          <ul className="divide-y rounded-md border bg-surface">
            {list.map((c) => (
              <li key={c.id} className="space-y-1 px-4 py-3 text-sm">
                <p className="font-medium">{formatDateRu(c.consulted_at)}</p>
                {c.complaints && <p><span className="text-muted-foreground">Жалобы: </span>{c.complaints}</p>}
                {c.skin_state && <p><span className="text-muted-foreground">Состояние кожи: </span>{c.skin_state}</p>}
                {c.notes && <p><span className="text-muted-foreground">Заметки: </span>{c.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

async function CardsTab({ id }: { id: string }) {
  const ctx = await getCtx();
  const cards = await ctx.db.select<CardRow>("patient_cards", { where: { patient_id: id }, order: { col: "updated_at" } });
  return (
    <div className="space-y-5">
      <NewCardButtons patientId={id} previousCardId={cards[0]?.id ?? null} />
      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">Карт пока нет.</p>
      ) : (
        <ul className="divide-y rounded-md border bg-surface">
          {cards.map((c) => (
            <li key={c.id}>
              <Link href={`/cards/${c.id}`} className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-secondary/60">
                <span>{c.title}</span>
                <span className={c.status === "approved" ? "text-green-800" : "text-amber-800"}>
                  {c.status === "approved" ? `Утверждена · версия ${c.version}` : c.version > 0 ? "Новая версия" : "Черновик"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function HistoryTab({ id }: { id: string }) {
  const ctx = await getCtx();
  const logs = await ctx.db.select<{ action: string; entity_id: string | null; meta: { patient_id?: string } }>("activity_logs", {
    order: { col: "created_at" },
    limit: 500,
  });
  const mine = logs.filter((l) => l.entity_id === id || l.meta?.patient_id === id).slice(0, 100);
  return mine.length === 0 ? (
    <p className="text-sm text-muted-foreground">Записей пока нет.</p>
  ) : (
    <ul className="divide-y rounded-md border bg-surface text-sm">
      {mine.map((l) => (
        <li key={l.id} className="flex justify-between gap-4 px-4 py-2.5">
          <span>{ACTION_LABEL[l.action] ?? l.action}</span>
          <time className="shrink-0 text-xs text-muted-foreground" dateTime={l.created_at}>
            {new Date(l.created_at).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
          </time>
        </li>
      ))}
    </ul>
  );
}
