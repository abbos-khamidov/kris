"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2, Pencil, Plus, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BlockEditor } from "@/components/block-editor";
import { Field } from "@/components/fields";
import { Block, mkBlock } from "@/lib/schemas/card";
import { BLOCK_KINDS, TEMPLATE_KINDS, TEMPLATE_LABEL, type TemplateKind } from "@/lib/templates";
import { cn } from "@/lib/utils";
import { archiveTemplateAction, getTemplateAction, saveTemplateAction, toggleFavoriteAction, type TemplateItem } from "./actions";

interface Draft {
  id?: string;
  kind: TemplateKind;
  title: string;
  blocks: Block[];
  /** Non-block kinds are created from the card editor and edited there. */
  editable: boolean;
}

export function TemplatesManager({ initial }: { initial: TemplateItem[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<TemplateKind | "">("");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, start] = useTransition();

  const rows = useMemo(
    () => initial.filter((t) => (!kind || t.kind === kind) && (!q.trim() || `${t.title} ${t.preview}`.toLowerCase().includes(q.trim().toLowerCase()))),
    [initial, kind, q],
  );

  const open = (t: TemplateItem) =>
    start(async () => {
      const r = await getTemplateAction(t.id, false);
      if (!r.ok) return void toast.error(r.error);
      const editable = BLOCK_KINDS.includes(t.kind);
      const parsed = editable ? Block.array().safeParse(r.data.body) : null;
      setDraft({ id: t.id, kind: t.kind, title: t.title, blocks: parsed?.success ? parsed.data : [], editable });
    });

  const save = () =>
    draft &&
    start(async () => {
      const body = draft.editable ? draft.blocks : undefined;
      const r = await saveTemplateAction({ id: draft.id, kind: draft.kind, title: draft.title, body: body ?? (await getTemplateAction(draft.id!, false).then((x) => (x.ok ? x.data.body : []))) });
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.data.duplicate ? "Такой шаблон уже есть" : "Сохранено");
      setDraft(null);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по тексту" aria-label="Поиск" className="h-11 pl-9 sm:h-8" />
        </div>
        <select aria-label="Раздел" value={kind} onChange={(e) => setKind(e.target.value as TemplateKind | "")} className="h-11 rounded-md border border-input bg-surface px-2 text-sm sm:h-8">
          <option value="">Все разделы</option>
          {TEMPLATE_KINDS.map((k) => (
            <option key={k} value={k}>
              {TEMPLATE_LABEL[k]}
            </option>
          ))}
        </select>
        <Button type="button" className="h-11 sm:h-8" onClick={() => setDraft({ kind: "skin", title: "", blocks: [mkBlock("p")], editable: true })}>
          <Plus /> Новый шаблон
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          {initial.length === 0 ? "Шаблонов пока нет. Создайте здесь или сохраните готовый текст прямо из карты." : "Ничего не найдено."}
        </p>
      ) : (
        <ul className="divide-y rounded-md border bg-surface">
          {rows.map((t) => (
            <li key={t.id} className="flex items-start gap-1 p-2 pr-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0 sm:size-8"
                aria-label={t.favorite ? "Убрать из избранного" : "В избранное"}
                onClick={() =>
                  start(async () => {
                    await toggleFavoriteAction(t.id);
                    router.refresh();
                  })
                }
              >
                <Star className={cn(t.favorite && "fill-primary text-primary")} />
              </Button>
              <div className="min-w-0 flex-1 py-1.5">
                <p className="text-sm font-medium">{t.title}</p>
                <p className="text-xs text-muted-foreground">
                  {TEMPLATE_LABEL[t.kind]}
                  {t.useCount > 0 && ` · использован ${t.useCount} раз`}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.preview}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 sm:size-8" aria-label="Редактировать" onClick={() => open(t)}>
                <Pencil />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0 sm:size-8"
                aria-label="В архив"
                onClick={() =>
                  start(async () => {
                    await archiveTemplateAction(t.id);
                    router.refresh();
                  })
                }
              >
                <Archive />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={!!draft} onOpenChange={(o) => !o && !pending && setDraft(null)}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
          {draft && (
            <>
              <SheetHeader className="border-b p-4">
                <SheetTitle className="font-serif text-lg">{draft.id ? "Шаблон" : "Новый шаблон"}</SheetTitle>
              </SheetHeader>
              <div className="flex-1 space-y-4 p-4">
                <Field label="Название" htmlFor="t-title">
                  <Input id="t-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="h-11 sm:h-8" />
                </Field>
                <Field label="Раздел" htmlFor="t-kind">
                  <select
                    id="t-kind"
                    disabled={!!draft.id}
                    value={draft.kind}
                    onChange={(e) => setDraft({ ...draft, kind: e.target.value as TemplateKind })}
                    className="h-11 w-full rounded-md border border-input bg-surface px-2 text-sm sm:h-8"
                  >
                    {BLOCK_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {TEMPLATE_LABEL[k]}
                      </option>
                    ))}
                    {!BLOCK_KINDS.includes(draft.kind) && <option value={draft.kind}>{TEMPLATE_LABEL[draft.kind]}</option>}
                  </select>
                </Field>
                {draft.editable ? (
                  <BlockEditor blocks={draft.blocks} onChange={(blocks) => setDraft({ ...draft, blocks })} label="Содержимое шаблона" />
                ) : (
                  <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    Содержимое этого шаблона создаётся и правится в редакторе карты (кнопка «Сохранить как шаблон»). Здесь можно изменить название.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Не указывайте имя пациента и другие персональные данные — приложение отклонит такой шаблон.</p>
              </div>
              <SheetFooter className="border-t p-4">
                <Button type="button" className="h-11 sm:h-8" disabled={pending || draft.title.trim().length < 2} onClick={save}>
                  {pending && <Loader2 className="animate-spin" />} Сохранить
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
