"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImageCropDialog } from "@/components/image-crop-dialog";
import { ImageDropzone } from "@/components/image-dropzone";
import { BRAND_INFO } from "@/lib/brand";
import { optimizeFile } from "@/lib/media/process";
import { uploadProcessed } from "@/lib/media/upload";
import type { BrandRole } from "@/lib/schemas/card";
import { cn } from "@/lib/utils";
import { archiveAssetAction, type AssetListItem } from "./actions";

const TABS = [
  { key: "brand", label: "Фирменные" },
  { key: "product", label: "Средства" },
  { key: "specialist", label: "Специалист" },
  { key: "illustration", label: "Иллюстрации" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export function MediaLibrary({ items, inUse }: { items: AssetListItem[]; inUse: Record<string, string> }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("brand");
  const [busy, setBusy] = useState(false);
  const [crop, setCrop] = useState<File | null>(null);
  const shown = useMemo(() => items.filter((a) => a.category === tab), [items, tab]);

  const upload = async (files: File[]) => {
    if (files.length === 1) return void setCrop(files[0]);
    setBusy(true);
    try {
      for (const f of files) await uploadProcessed(await optimizeFile(f), { category: tab, name: f.name });
      toast.success(`Загружено: ${files.length}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Категории" className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px min-h-11 shrink-0 border-b-2 px-4 text-sm transition-colors",
              tab === t.key ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label} <span className="text-xs text-muted-foreground">{items.filter((a) => a.category === t.key).length}</span>
          </button>
        ))}
      </div>

      <ImageDropzone multiple onFiles={upload} disabled={busy} label="Перетащите изображения сюда или выберите" />
      {busy && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Загрузка…
        </p>
      )}

      {shown.length === 0 ? (
        <p className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">В этой категории пока нет изображений.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {shown.map((a, i) => {
            const role = inUse[a.id] as BrandRole | undefined;
            return (
              <li key={a.id} className="group animate-fade-in overflow-hidden rounded-md border bg-surface" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                <div className="aspect-square overflow-hidden bg-secondary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt={a.name || "Изображение"} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
                </div>
                <div className="flex items-center justify-between gap-1 p-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs">{a.name || "Без названия"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {a.width}×{a.height}
                      {role && <span className="ml-1 font-medium text-primary">· {BRAND_INFO[role]?.label ?? role}</span>}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 shrink-0 sm:size-8"
                    aria-label="В архив"
                    onClick={async () => {
                      const r = await archiveAssetAction(a.id);
                      if (!r.ok) return void toast.error(r.error);
                      toast.success("Перенесено в архив");
                      router.refresh();
                    }}
                  >
                    <Archive />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ImageCropDialog
        file={crop}
        title="Кадрирование и поворот"
        onCancel={() => setCrop(null)}
        onDone={async (img) => {
          if (!crop) return;
          try {
            await uploadProcessed(img, { category: tab, name: crop.name });
            toast.success("Изображение добавлено");
            setCrop(null);
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Не удалось загрузить");
          }
        }}
      />
    </div>
  );
}
