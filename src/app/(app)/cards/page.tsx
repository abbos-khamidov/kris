import Link from "next/link";
import { getCtx } from "@/lib/db";
import { formatDateRu } from "@/lib/format";
import type { PatientRow } from "@/lib/schemas/patient";
import { cn } from "@/lib/utils";
import type { CardRow } from "@/lib/services/cards";

export const metadata = { title: "Карты" };
export const dynamic = "force-dynamic";

export default async function CardsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter = status === "draft" || status === "approved" ? status : null;
  const ctx = await getCtx();
  const [cards, patients] = await Promise.all([
    ctx.db.select<CardRow>("patient_cards", { where: filter ? { status: filter } : undefined, order: { col: "updated_at" } }),
    ctx.db.select<PatientRow>("patients"),
  ]);
  const name = (id: string) => patients.find((p) => p.id === id)?.full_name ?? "Пациент удалён";

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="text-2xl">Карты</h1>
      <nav className="flex gap-4 text-sm" aria-label="Фильтр">
        {([[null, "Все"], ["draft", "Черновики"], ["approved", "Утверждённые"]] as const).map(([k, label]) => (
          <Link key={label} href={k ? `/cards?status=${k}` : "/cards"} className={cn(filter === k ? "font-medium text-primary" : "text-muted-foreground")}>
            {label}
          </Link>
        ))}
      </nav>
      {cards.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          Карт пока нет. Откройте пациента и создайте карту во вкладке «Карты».
        </div>
      ) : (
        <ul className="divide-y rounded-md border bg-surface">
          {cards.map((c) => (
            <li key={c.id}>
              <Link href={`/cards/${c.id}`} className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-secondary/60">
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
