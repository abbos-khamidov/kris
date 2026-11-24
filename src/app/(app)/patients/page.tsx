import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCtx } from "@/lib/db";
import { ageFromBirthDate, formatDateRu, pluralYears } from "@/lib/format";
import type { PatientRow } from "@/lib/schemas/patient";

export const metadata = { title: "Пациенты" };

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archived?: string }>;
}) {
  const { q = "", archived } = await searchParams;
  const ctx = await getCtx();
  const showArchived = archived === "1";
  const all = await ctx.db.select<PatientRow>("patients", {
    search: { cols: ["full_name", "phone"], q },
    order: { col: "updated_at" },
  });
  const rows = all.filter((p) => (showArchived ? !!p.archived_at : !p.archived_at));
  const cards = await ctx.db.select("patient_cards");
  const qs = q ? `&q=${encodeURIComponent(q)}` : "";

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Пациенты</h1>
        <Button render={<Link href="/patients/new" />} className="h-11 sm:h-8">
          <Plus /> Новый пациент
        </Button>
      </div>

      <form className="flex gap-2" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Поиск по ФИО или телефону" className="h-11 pl-9 sm:h-8" />
        </div>
        {showArchived && <input type="hidden" name="archived" value="1" />}
        <Button type="submit" variant="outline" className="h-11 sm:h-8">
          Найти
        </Button>
      </form>

      <div className="flex gap-4 text-sm">
        <Link href={`/patients?${qs.slice(1)}`} className={!showArchived ? "font-medium text-primary" : "text-muted-foreground"}>
          Активные
        </Link>
        <Link href={`/patients?archived=1${qs}`} className={showArchived ? "font-medium text-primary" : "text-muted-foreground"}>
          Архив
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          {q ? "Ничего не найдено." : showArchived ? "Архив пуст." : "Пока нет пациентов. Создайте первого."}
        </div>
      ) : (
        <ul className="divide-y rounded-md border bg-surface">
          {rows.map((p) => {
            const age = ageFromBirthDate(p.birth_date);
            const count = cards.filter((c) => c.patient_id === p.id).length;
            return (
              <li key={p.id}>
                <Link href={`/patients/${p.id}`} className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-secondary/60">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[age != null ? `${age} ${pluralYears(age)}` : null, p.phone || null].filter(Boolean).join(" · ") ||
                        "Контакты не указаны"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <p>Карт: {count}</p>
                    <p>изменён {formatDateRu(p.updated_at)}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
