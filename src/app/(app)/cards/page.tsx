import Link from "next/link";
import { getCtx } from "@/lib/db";
import { formatDateRu } from "@/lib/format";
import type { PatientRow } from "@/lib/schemas/patient";
import { cn } from "@/lib/utils";
import type { CardRow } from "@/lib/services/cards";
import { CardArchiveButton } from "./archive-button";

export const metadata = { title: "Карты" };
export const dynamic = "force-dynamic";

export default async function CardsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter = status === "draft" || status === "approved" || status === "archive" ? status : null;
  const ctx = await getCtx();
  const [all, patients] = await Promise.all([
    ctx.db.select<CardRow>("patient_cards", { order: { col: "updated_at" } }),
    ctx.db.select<PatientRow>("patients"),
  ]);
  const cards = all.filter((c) => (filter === "archive" ? !!c.archived_at : !c.archived_at && (!filter || c.status === filter)));
  const name = (id: string) => patients.find((p) => p.id === id)?.full_name ?? "Пациент удалён";

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="text-2xl">Карты</h1>
      <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Фильтр">
        {([[null, "Все"], ["draft", "Черновики"], ["approved", "Утверждённые"], ["archive", "Архив"]] as const).map(([k, label]) => (
          <Link key={label} href={k ? `/cards?status=${k}` : "/cards"} className={cn("inline-flex min-h-11 items-center sm:min-h-0", filter === k ? "font-medium text-primary" : "text-muted-foreground")}>
            {label}
          </Link>
        ))}
      </nav>
      {cards.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          {filter === "archive" ? "Архив пуст." : "Карт пока нет. Откройте пациента и создайте карту во вкладке «Карты пациента»."}
        </div>
      ) : (
        <ul className="divide-y rounded-md border bg-surface">
          {cards.map((c) => (
            <li key={c.id} className="flex items-center gap-2 pr-2">
              <Link href={`/cards/${c.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-4 px-4 py-3.5 hover:bg-secondary/60">
                <div className="min-w-0">
                  <p className="truncate font-medium">{name(c.patient_id)}</p>
                  <p className="text-xs text-muted-foreground">{c.title}</p>
                </div>
                <div className="shrink-0 text-right text-xs">
                  <p className={c.status === "approved" ? "text-green-800" : "text-amber-800"}>
                    {c.status === "approved" ? `Утверждена · версия ${c.version}` : c.version > 0 ? `Новая версия (была ${c.version})` : "Черновик"}
                  </p>
                  <p className="text-muted-foreground">изменена {formatDateRu(c.updated_at)}</p>
                </div>
              </Link>
              <CardArchiveButton cardId={c.id} archived={!!c.archived_at} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
