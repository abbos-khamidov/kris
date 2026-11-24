"use client";
import { useCallback, useEffect, useState } from "react";
import { Library, Loader2, Save, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getTemplateAction,
  listTemplatesAction,
  saveTemplateAction,
  searchApprovedAction,
  toggleFavoriteAction,
  type PastFragment,
  type TemplateItem,
} from "@/app/(app)/templates/actions";
import { BLOCK_KINDS, TEMPLATE_LABEL, type TemplateKind } from "@/lib/templates";
import { cn } from "@/lib/utils";

/**
 * "From library" + "Save as template" for any field. The body is opaque here: blocks, products,
 * procedures or face-scheme strokes. Inserted content is only a COPY — the specialist reviews and
 * approves it for every new patient; nothing is applied automatically.
 */
export function TemplateBar({
  kind,
  getBody,
  onInsert,
  canSave = true,
}: {
  kind: TemplateKind;
  getBody: () => unknown;
  /** Receives the stored body (blocks array, items, strokes…) or a past-card fragment's blocks. */
  onInsert: (body: unknown) => void;
  canSave?: boolean;
}) {
  const [pick, setPick] = useState(false);
  const [save, setSave] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" className="h-11 sm:h-8" onClick={() => setPick(true)}>
        <Library /> Из библиотеки
      </Button>
      {canSave && (
        <Button type="button" variant="outline" className="h-11 sm:h-8" onClick={() => setSave(true)}>
          <Save /> Сохранить как шаблон
        </Button>
      )}
      {pick && <PickerDialog kind={kind} onClose={() => setPick(false)} onInsert={onInsert} />}
      {save && <SaveDialog kind={kind} body={getBody()} onClose={() => setSave(false)} />}
    </>
  );
}

function PickerDialog({ kind, onClose, onInsert }: { kind: TemplateKind; onClose: () => void; onInsert: (body: unknown) => void }) {
  const [tab, setTab] = useState<"templates" | "past">("templates");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<TemplateItem[] | null>(null);
  const [past, setPast] = useState<PastFragment[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const hasPast = BLOCK_KINDS.includes(kind);

  const load = useCallback(async () => {
    if (tab === "templates") {
      const r = await listTemplatesAction({ kind, q });
      if (r.ok) setItems(r.data);
      else toast.error(r.error);
    } else {
      const r = await searchApprovedAction(q);
      if (r.ok) setPast(r.data);
      else toast.error(r.error);
    }
  }, [tab, kind, q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl gap-3 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Библиотека: {TEMPLATE_LABEL[kind]}</DialogTitle>
          <DialogDescription>Вставляется копия. Проверьте текст и отредактируйте под этого пациента.</DialogDescription>
        </DialogHeader>
        {hasPast && (
          <div role="tablist" className="grid grid-cols-2 border-b text-sm">
            {(
              [
                ["templates", "Шаблоны"],
                ["past", "Из прошлых карт"],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("min-h-11 border-b-2", tab === k ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground")}>
                {label}
              </button>
            ))}
          </div>
        )}
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по тексту" aria-label="Поиск" className="h-11 sm:h-8" />
        <div className="max-h-[45vh] overflow-y-auto">
          {tab === "templates" &&
            (items === null ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Загрузка…</p>
            ) : items.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Шаблонов пока нет. Сохраните готовый текст кнопкой «Сохранить как шаблон».</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {items.map((t) => (
                  <li key={t.id} className="flex items-start gap-2 p-3">
                    <button
                      type="button"
                      aria-label={t.favorite ? "Убрать из избранного" : "В избранное"}
                      className="grid size-11 shrink-0 place-items-center text-muted-foreground hover:text-primary sm:size-8"
                      onClick={async () => {
                        await toggleFavoriteAction(t.id);
                        void load();
                      }}
                    >
                      <Star className={cn("size-4", t.favorite && "fill-primary text-primary")} />
                    </button>
                    <button
                      type="button"
                      disabled={busy === t.id}
                      className="min-w-0 flex-1 text-left"
                      onClick={async () => {
                        setBusy(t.id);
                        const r = await getTemplateAction(t.id);
                        setBusy(null);
                        if (!r.ok) return void toast.error(r.error);
                        onInsert(r.data.body);
                        onClose();
                      }}
                    >
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{t.preview}</p>
                      {t.useCount > 0 && <p className="mt-0.5 text-[11px] text-muted-foreground">использован {t.useCount} раз</p>}
                    </button>
                    {busy === t.id && <Loader2 className="mt-2 size-4 animate-spin" />}
                  </li>
                ))}
              </ul>
            ))}
          {tab === "past" &&
            (past === null ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Загрузка…</p>
            ) : past.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">В утверждённых картах ничего не найдено.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {past.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      className="w-full p-3 text-left hover:bg-secondary/60"
                      onClick={() => {
                        onInsert(f.blocks);
                        onClose();
                      }}
                    >
                      <p className="text-xs text-muted-foreground">{f.section}</p>
                      <p className="line-clamp-3 text-sm">{f.text}</p>
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SaveDialog({ kind, body, onClose }: { kind: TemplateKind; body: unknown; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-lg">Сохранить как шаблон</DialogTitle>
          <DialogDescription>
            Раздел «{TEMPLATE_LABEL[kind]}». В шаблон не должно попадать имя пациента и другие персональные данные — приложение проверит это, но убедитесь сами. Медицинские рекомендации
            из шаблона нужно проверять заново для каждого пациента.
          </DialogDescription>
        </DialogHeader>
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название шаблона" aria-label="Название шаблона" className="h-11 sm:h-8" />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="h-11 sm:h-8">
            Отмена
          </Button>
          <Button
            type="button"
            className="h-11 sm:h-8"
            disabled={busy || title.trim().length < 2}
            onClick={async () => {
              setBusy(true);
              const r = await saveTemplateAction({ kind, title, body });
              setBusy(false);
              if (!r.ok) return void toast.error(r.error);
              toast.success(r.data.duplicate ? "Такой шаблон уже есть в библиотеке" : "Шаблон сохранён");
              onClose();
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
