"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Field } from "@/components/fields";
import { PriceEditor } from "@/components/price-editor";
import { VoiceInput } from "@/components/voice-input";
import { formatPrice } from "@/lib/format";
import { emptyPrice, uid } from "@/lib/schemas/common";
import { archiveProductAction, saveProductAction, type CatalogProduct } from "./actions";

type Cat = { id: string; name: string };
const blank = (): CatalogProduct => ({
  id: "",
  name: "",
  brand: "",
  categoryId: null,
  description: "",
  variants: [{ id: uid(), volume: "", price: emptyPrice() }],
  url: "",
  restrictions: "",
  alternatives: [],
  inStock: true,
  archived: false,
});

export function CatalogManager({ categories, initial }: { categories: Cat[]; initial: CatalogProduct[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<CatalogProduct | null>(null);
  const [pending, start] = useTransition();

  const rows = useMemo(
    () =>
      initial
        .filter((p) => showArchived || !p.archived)
        .filter((p) => !cat || p.categoryId === cat)
        .filter((p) => !q.trim() || `${p.brand} ${p.name}`.toLowerCase().includes(q.trim().toLowerCase())),
    [initial, q, cat, showArchived],
  );
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Без категории";

  const save = () =>
    editing &&
    start(async () => {
      const res = await saveProductAction({ ...editing, id: editing.id || undefined });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Сохранено");
      setEditing(null);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по названию или бренду" aria-label="Поиск" className="h-11 pl-9 sm:h-8" />
        </div>
        <select aria-label="Категория" value={cat} onChange={(e) => setCat(e.target.value)} className="h-11 rounded-md border border-input bg-surface px-2 text-sm sm:h-8">
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Button type="button" className="h-11 sm:h-8" onClick={() => setEditing(blank())}>
          <Plus /> Добавить средство
        </Button>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground sm:min-h-0">
        <input type="checkbox" className="size-4 accent-primary" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Показывать архив
      </label>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          {initial.length === 0 ? "Каталог пуст. Добавьте первое средство." : "Ничего не найдено."}
        </p>
      ) : (
        <ul className="divide-y rounded-md border bg-surface">
          {rows.map((p) => (
            <li key={p.id} className={`flex items-start justify-between gap-3 px-4 py-3 ${p.archived ? "opacity-60" : ""}`}>
              <div className="min-w-0">
                <p className="font-medium">{[p.brand, p.name].filter(Boolean).join(" ")}</p>
                <p className="text-xs text-muted-foreground">
                  {catName(p.categoryId)}
                  {p.variants.length > 0 && " · " + p.variants.map((v) => [v.volume, formatPrice(v.price)].filter(Boolean).join(" — ")).filter(Boolean).join(" / ")}
                  {!p.inStock && " · нет в наличии"}
                </p>
              </div>
              <div className="flex shrink-0">
                <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-8" aria-label="Редактировать" onClick={() => setEditing(structuredClone(p))}>
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 sm:size-8"
                  aria-label={p.archived ? "Вернуть из архива" : "В архив"}
                  onClick={() =>
                    start(async () => {
                      const r = await archiveProductAction(p.id, !p.archived);
                      if (!r.ok) return void toast.error(r.error);
                      router.refresh();
                    })
                  }
                >
                  {p.archived ? <ArchiveRestore /> : <Archive />}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={!!editing} onOpenChange={(o) => !o && !pending && setEditing(null)}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
          {editing && (
            <>
              <SheetHeader className="border-b p-4">
                <SheetTitle className="font-serif text-lg">{editing.id ? "Редактирование средства" : "Новое средство"}</SheetTitle>
              </SheetHeader>
              <div className="flex-1 space-y-4 p-4">
                <Field label="Название *" htmlFor="pr-name">
                  <Input id="pr-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="h-11 sm:h-8" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Бренд" htmlFor="pr-brand">
                    <Input id="pr-brand" value={editing.brand} onChange={(e) => setEditing({ ...editing, brand: e.target.value })} className="h-11 sm:h-8" />
                  </Field>
                  <Field label="Категория" htmlFor="pr-cat">
                    <select id="pr-cat" value={editing.categoryId ?? ""} onChange={(e) => setEditing({ ...editing, categoryId: e.target.value || null })} className="h-11 w-full rounded-md border border-input bg-surface px-2 text-sm sm:h-8">
                      <option value="">Без категории</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="space-y-3">
                  <p className="text-[13px] font-medium">Объёмы и цены</p>
                  {editing.variants.map((v, i) => (
                    <div key={v.id} className="space-y-2 rounded-md border p-3">
                      <div className="flex gap-2">
                        <Input value={v.volume} placeholder="Объём, например 50 мл" aria-label="Объём" onChange={(e) => setEditing({ ...editing, variants: editing.variants.map((x, k) => (k === i ? { ...x, volume: e.target.value } : x)) })} className="h-11 flex-1 sm:h-8" />
                        <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-8" aria-label="Удалить вариант" disabled={editing.variants.length === 1} onClick={() => setEditing({ ...editing, variants: editing.variants.filter((_, k) => k !== i) })}>
                          <Trash2 />
                        </Button>
                      </div>
                      <PriceEditor label={`Вариант ${i + 1}`} value={v.price} onChange={(price) => setEditing({ ...editing, variants: editing.variants.map((x, k) => (k === i ? { ...x, price } : x)) })} />
                    </div>
                  ))}
                  <Button type="button" variant="ghost" size="sm" className="h-11 sm:h-7" disabled={editing.variants.length >= 8} onClick={() => setEditing({ ...editing, variants: [...editing.variants, { id: uid(), volume: "", price: emptyPrice() }] })}>
                    <Plus /> Ещё объём / цена
                  </Button>
                </div>
                <Field label="Описание">
                  <VoiceInput value={editing.description} onChange={(description) => setEditing({ ...editing, description })} rows={3} aria-label="Описание" />
                </Field>
                <Field label="Ссылка на покупку" htmlFor="pr-url">
                  <Input id="pr-url" type="url" inputMode="url" value={editing.url} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://" className="h-11 sm:h-8" />
                </Field>
                <Field label="Ограничения">
                  <VoiceInput value={editing.restrictions} onChange={(restrictions) => setEditing({ ...editing, restrictions })} rows={2} aria-label="Ограничения" />
                </Field>
                <div className="space-y-2">
                  <p className="text-[13px] font-medium">Альтернативы</p>
                  {editing.alternatives.map((a, i) => (
                    <div key={i} className="flex gap-2">
                      <Input value={a.brand} placeholder="Бренд" aria-label="Бренд альтернативы" onChange={(e) => setEditing({ ...editing, alternatives: editing.alternatives.map((x, k) => (k === i ? { ...x, brand: e.target.value } : x)) })} className="h-11 w-32 sm:h-8" />
                      <Input value={a.name} placeholder="Название" aria-label="Название альтернативы" onChange={(e) => setEditing({ ...editing, alternatives: editing.alternatives.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)) })} className="h-11 flex-1 sm:h-8" />
                      <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-8" aria-label="Удалить альтернативу" onClick={() => setEditing({ ...editing, alternatives: editing.alternatives.filter((_, k) => k !== i) })}>
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="ghost" size="sm" className="h-11 sm:h-7" onClick={() => setEditing({ ...editing, alternatives: [...editing.alternatives, { name: "", brand: "" }] })}>
                    <Plus /> Альтернатива
                  </Button>
                </div>
                <label className="flex min-h-11 items-center gap-2 text-sm sm:min-h-8">
                  <input type="checkbox" className="size-4 accent-primary" checked={editing.inStock} onChange={(e) => setEditing({ ...editing, inStock: e.target.checked })} />
                  В наличии
                </label>
              </div>
              <SheetFooter className="border-t p-4">
                <Button type="button" className="h-11 sm:h-8" onClick={save} disabled={pending || editing.name.trim().length < 2}>
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
