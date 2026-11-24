"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderUp, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImageCropDialog } from "@/components/image-crop-dialog";
import { optimizeFile, type ProcessedImage } from "@/lib/media/process";
import { uploadProcessed } from "@/lib/media/upload";
import { BRAND_ROLES, type BrandRole } from "@/lib/schemas/card";
import { setBrandImageAction } from "../media/actions";

interface Item {
  role: BrandRole;
  label: string;
  hint: string;
  aspect?: number;
  assetId: string | null;
  url: string | null;
}

export function BrandImages({ items }: { items: Item[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<{ item: Item; file: File } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const pick = useRef<HTMLInputElement>(null);
  const bulk = useRef<HTMLInputElement>(null);
  const [pickRole, setPickRole] = useState<Item | null>(null);

  const apply = async (role: BrandRole, img: ProcessedImage, name: string) => {
    const asset = await uploadProcessed(img, { category: "brand", role, name });
    const res = await setBrandImageAction(role, asset.id);
    if (!res.ok) throw new Error(res.error);
  };

  const onBulk = async (files: FileList | null) => {
    if (!files) return;
    let done = 0;
    setBusy("bulk");
    for (const f of Array.from(files)) {
      const base = f.name.replace(/\.[^.]+$/, "");
      const role = BRAND_ROLES.find((r) => r === base);
      if (!role) {
        toast.error(`${f.name}: имя файла должно совпадать с названием слота (например cover.jpg)`);
        continue;
      }
      try {
        await apply(role, await optimizeFile(f), f.name);
        done++;
      } catch (e) {
        toast.error(`${f.name}: ${e instanceof Error ? e.message : "ошибка"}`);
      }
    }
    setBusy(null);
    if (done) toast.success(`Загружено изображений: ${done}`);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed p-3 text-sm">
        <Button type="button" variant="outline" className="h-11 sm:h-8" disabled={busy === "bulk"} onClick={() => bulk.current?.click()}>
          {busy === "bulk" ? <Loader2 className="animate-spin" /> : <FolderUp />} Загрузить комплект
        </Button>
        <span className="text-muted-foreground">
          Несколько файлов сразу: имена по слотам — {BRAND_ROLES.filter((r) => r !== "logo").join(", ")} (.jpg/.png).
        </span>
        <input ref={bulk} type="file" multiple hidden accept="image/*,.heic" onChange={(e) => { void onBulk(e.target.files); e.target.value = ""; }} />
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map((it) => (
          <li key={it.role} className="flex gap-3 rounded-md border bg-surface p-3">
            <div className="grid h-28 w-20 shrink-0 place-items-center overflow-hidden rounded bg-secondary">
              {it.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.url} alt={it.label} className="size-full object-cover" />
              ) : (
                <span className="px-1 text-center text-[10px] text-muted-foreground">нет изображения</span>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="font-medium">{it.label}</p>
              <p className="mb-2 text-xs text-muted-foreground">{it.hint}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-auto h-11 w-fit sm:h-7"
                onClick={() => {
                  setPickRole(it);
                  pick.current?.click();
                }}
              >
                <ImagePlus /> {it.url ? "Заменить" : "Загрузить"}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <input
        ref={pick}
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && pickRole) setTarget({ item: pickRole, file: f });
          e.target.value = "";
        }}
      />

      <ImageCropDialog
        file={target?.file ?? null}
        aspect={target?.item.aspect}
        title={target ? `${target.item.label}: кадрирование` : ""}
        onCancel={() => setTarget(null)}
        onDone={async (img) => {
          if (!target) return;
          await apply(target.item.role, img, target.file.name);
          toast.success("Изображение заменено");
          setTarget(null);
          router.refresh();
        }}
      />
    </div>
  );
}
