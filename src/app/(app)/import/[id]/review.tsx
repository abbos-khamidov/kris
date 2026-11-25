"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TEMPLATE_KINDS, TEMPLATE_LABEL, type TemplateKind } from "@/lib/templates";
import { formatDateRu } from "@/lib/format";
import { cn } from "@/lib/utils";
import { decideCandidatesAction, deleteImportAction, type CandidateItem, getImportAction } from "../actions";

type Data = Extract<Awaited<ReturnType<typeof getImportAction>>, { ok: true }>["data"];

const SECTION_LABEL: Record<string, string> = {
  skin: "Состояние кожи",
  care: "Схема ухода",
  actives: "Активы и лечебные средства",
  nutrition: "Питание",
  vitamins: "Витамины и анализы",
  conclusion: "Заключение",
  products: "Рекомендованные средства",
  procedures: "План процедур",
};
const DEFAULT_KIND: Record<string, TemplateKind> = { skin: "skin", care: "morning", actives: "actives", nutrition: "nutrition", vitamins: "vitamins", conclusion: "conclusion" };

export function ReviewImport({ id, data }: { id: string; data: Data }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const open = data.candidates.filter((c) => c.status === "pending");
  const done = data.candidates.length - open.length;
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [text, setText] = useState<Record<string, string>>(() => Object.fromEntries(data.candidates.map((c) => [c.id, c.text])));
  const [kinds, setKinds] = useState<Record<string, TemplateKind>>({});
  const [showPersonal, setShowPersonal] = useState(false);

  const groups = useMemo(() => {
    const m = new Map<string, CandidateItem[]>();
    for (const c of open) m.set(c.section, [...(m.get(c.section) ?? []), c]);
    return [...m.entries()];
  }, [open]);

  const chosen = open.filter((c) => picked[c.id]);

  const submit = () =>
    start(async () => {
      const res = await decideCandidatesAction(id, {
        accept: chosen.map((c) => ({ id: c.id, text: text[c.id] ?? c.text, kind: c.kind === "text_block" ? (kinds[c.id] ?? DEFAULT_KIND[c.section]) : undefined })),
        reject: open.filter((c) => !picked[c.id]).map((c) => c.id),
      });
      if (!res.ok) return void toast.error(res.error);
      const r = res.data;
      toast.success(`Добавлено: шаблонов ${r.templates}, средств ${r.products}, процедур ${r.procedures}${r.duplicates ? `, дубликатов пропущено ${r.duplicates}` : ""}`);
      router.refresh();
    });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/import" className="inline-flex min-h-11 items-center text-xs text-muted-foreground hover:text-primary sm:min-h-0">
            ← Все импорты
          </Link>
          <h1 className="break-words text-2xl">{data.summary.fileName}</h1>
          <p className="text-sm text-muted-foreground">
            Импорт от {formatDateRu(data.summary.importedAt)} · {data.summary.pages} стр. · проверено {done} из {data.candidates.length}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11 sm:h-8"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await deleteImportAction(id);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Импорт и данные пациента из карты удалены");
              router.push("/import");
            })
          }
        >
          <Trash2 /> Удалить импорт
        </Button>
      </div>

      <div className="rounded-md border bg-surface p-4 text-sm">
        <p className="text-muted-foreground">
          Это черновик: приложение ничего не утверждает и не назначает. Отметьте только то, что вы проверили и готовы использовать как шаблон. Текст можно отредактировать до добавления.
        </p>
        {data.summary.unrecognised.length > 0 && <p className="mt-2 text-amber-800">Не удалось определить раздел на страницах: {data.summary.unrecognised.join(", ")}.</p>}
      </div>

      <section className="rounded-md border bg-surface">
        <button type="button" onClick={() => setShowPersonal((v) => !v)} className="flex min-h-11 w-full items-center justify-between px-4 text-left text-sm">
          <span className="font-medium">Персональные данные пациента из карты</span>
          <span className="text-xs text-muted-foreground">{showPersonal ? "скрыть" : "показать"} · хранятся только здесь</span>
        </button>
        {showPersonal && (
          <ul className="space-y-1 border-t px-4 py-3 text-sm text-muted-foreground">
            {data.patientData.lines.length ? data.patientData.lines.map((l, i) => <li key={i}>{l}</li>) : <li>Не найдены</li>}
          </ul>
        )}
      </section>

      {open.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">Все найденные элементы проверены.</p>
      ) : (
        <>
          {groups.map(([section, items]) => (
            <section key={section} className="space-y-2">
              <h2 className="text-lg">{SECTION_LABEL[section] ?? section}</h2>
              <ul className="space-y-2">
                {items.map((c) => (
                  <li key={c.id} className={cn("rounded-md border bg-surface p-3", picked[c.id] && "border-primary/50")}>
                    <label className="flex min-h-11 items-start gap-3">
                      <input type="checkbox" className="mt-1 size-5 accent-primary" checked={!!picked[c.id]} onChange={(e) => setPicked({ ...picked, [c.id]: e.target.checked })} />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="mb-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                          {c.kind === "product" && <span>Средство{c.isAlternative ? " (альтернатива)" : ""}{c.price ? ` · ${c.price}` : ""}</span>}
                          {c.kind === "procedure" && <span>Процедура{c.isAlternative ? " (альтернатива)" : ""}{c.price ? ` · ${c.price}` : ""}</span>}
                          {c.occurrences > 1 && <span>встречается в {c.occurrences} картах</span>}
                          {c.inLibrary && <span className="text-amber-800">уже есть в библиотеке</span>}
                        </span>
                        {c.kind === "text_block" ? (
                          <Textarea value={text[c.id]} onChange={(e) => setText({ ...text, [c.id]: e.target.value })} rows={3} aria-label="Текст" />
                        ) : (
                          <input
                            value={text[c.id]}
                            onChange={(e) => setText({ ...text, [c.id]: e.target.value })}
                            aria-label="Название"
                            className="h-11 w-full rounded-md border border-input bg-transparent px-2.5 text-sm sm:h-8"
                          />
                        )}
                      </span>
                    </label>
                    {c.kind === "text_block" && picked[c.id] && (
                      <div className="mt-2 flex items-center gap-2 pl-8 text-xs">
                        <span className="text-muted-foreground">Раздел шаблона:</span>
                        <select
                          aria-label="Раздел шаблона"
                          value={kinds[c.id] ?? DEFAULT_KIND[c.section]}
                          onChange={(e) => setKinds({ ...kinds, [c.id]: e.target.value as TemplateKind })}
                          className="h-11 rounded-md border border-input bg-surface px-2 text-sm sm:h-8"
                        >
                          {TEMPLATE_KINDS.filter((k) => k !== "face_scheme").map((k) => (
                            <option key={k} value={k}>
                              {TEMPLATE_LABEL[k]}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:mx-0 lg:px-0">
            <p className="text-sm text-muted-foreground">Отмечено: {chosen.length}. Неотмеченное будет отклонено.</p>
            <Button type="button" className="h-11 sm:h-8" disabled={pending} onClick={submit}>
              {pending && <Loader2 className="animate-spin" />} Добавить отмеченное в библиотеку
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
