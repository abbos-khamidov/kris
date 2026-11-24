"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageDropzone } from "@/components/image-dropzone";
import { listAssetsAction, type AssetListItem } from "@/app/(app)/media/actions";
import { optimizeFile } from "@/lib/media/process";
import { uploadProcessed } from "@/lib/media/upload";
import { cn } from "@/lib/utils";

/** Choose a ready image from the media library, or upload a new one (gallery, camera, drag-and-drop). */
export function MediaPicker({
  open,
  onClose,
  onPick,
  category,
  title = "Выберите изображение",
}: {
  open: boolean;
  onClose: () => void;
  onPick: (assetId: string) => void;
  /** Library category shown and used for new uploads. */
  category: "brand" | "product" | "specialist" | "patient" | "illustration";
  title?: string;
}) {
  const [items, setItems] = useState<AssetListItem[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await listAssetsAction(category);
    if (res.ok) setItems(res.data);
    else toast.error(res.error);
  }, [category]);

  useEffect(() => {
    if (open) void load();
    else setItems(null);
  }, [open, load]);

  const upload = async (files: File[]) => {
    setBusy(true);
    try {
      for (const f of files) {
        const asset = await uploadProcessed(await optimizeFile(f), { category, name: f.name });
        if (files.length === 1) {
          onPick(asset.id);
          onClose();
          return;
        }
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
        </DialogHeader>
        <ImageDropzone onFiles={upload} multiple compact disabled={busy} />
        {busy && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Загрузка…
          </p>
        )}
        <div className="max-h-[50vh] overflow-y-auto">
          {items === null ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Загрузка…</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">В этой категории пока нет изображений.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {items.map((it) => (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(it.id);
                      onClose();
                    }}
                    className={cn("group block aspect-square w-full overflow-hidden rounded-md border bg-secondary hover:border-primary")}
                    title={it.name}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.url} alt={it.name || "Изображение"} className="size-full object-cover" loading="lazy" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
