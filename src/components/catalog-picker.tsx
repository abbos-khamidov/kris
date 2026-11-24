"use client";
import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listProductsAction, type CatalogProduct } from "@/app/(app)/catalog/actions";
import type { ProductItem } from "@/lib/schemas/card";
import { emptyPrice, uid } from "@/lib/schemas/common";
import { formatPrice } from "@/lib/format";

/** Adds catalog products to the card in one tap. Names, volumes and prices are COPIED into the card. */
export function CatalogPicker({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (items: ProductItem[]) => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<CatalogProduct[] | null>(null);

  const load = useCallback(async () => {
    const r = await listProductsAction({ q });
    if (r.ok) setItems(r.data);
    else toast.error(r.error);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [open, load]);

  const toItem = (p: CatalogProduct, isAlternative = false): ProductItem => ({
    id: uid(),
    productId: p.id,
    label: "",
    brand: p.brand,
    name: p.name,
    isAlternative,
    variants: p.variants.length ? p.variants.map((v) => ({ id: uid(), volume: v.volume, price: structuredClone(v.price) })) : [{ id: uid(), volume: "", price: emptyPrice() }],
    note: "",
    url: p.url,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl gap-3 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Добавить из каталога</DialogTitle>
          <DialogDescription>В карту копируются название, объёмы и цены. Дальнейшие изменения каталога карту не затронут.</DialogDescription>
        </DialogHeader>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по названию или бренду" aria-label="Поиск" className="h-11 sm:h-8" />
        <div className="max-h-[50vh] overflow-y-auto">
          {items === null ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Загрузка…</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Каталог пуст. Добавьте средства в разделе «Каталог средств».</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {items.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{[p.brand, p.name].filter(Boolean).join(" ")}</p>
                    <p className="text-xs text-muted-foreground">{p.variants.map((v) => [v.volume, formatPrice(v.price)].filter(Boolean).join(" — ")).filter(Boolean).join(" / ") || "цена не указана"}</p>
                    {!p.inStock && <p className="text-xs text-amber-800">нет в наличии</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="sm"
                      className="h-11 sm:h-7"
                      onClick={() => {
                        onAdd([toItem(p)]);
                        toast.success("Добавлено");
                      }}
                    >
                      <Plus /> Добавить
                    </Button>
                    {p.alternatives.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-11 sm:h-7"
                        onClick={() => {
                          onAdd([toItem(p), ...p.alternatives.map((a) => ({ ...toItem({ ...p, brand: a.brand, name: a.name, variants: [], url: "" }, true) }))]);
                          toast.success("Добавлено с альтернативами");
                        }}
                      >
                        + альтернативы
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
