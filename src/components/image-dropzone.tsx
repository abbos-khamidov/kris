"use client";
import { useRef, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { validateImageFile } from "@/lib/media/process";
import { cn } from "@/lib/utils";

/**
 * Pick from the computer or phone gallery, shoot with the phone camera, or drag-and-drop —
 * single or multiple. Files are validated here; processing/upload is the caller's job.
 */
export function ImageDropzone({
  onFiles,
  multiple = false,
  compact = false,
  label = "Перетащите фото сюда или выберите",
  disabled,
}: {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  compact?: boolean;
  label?: string;
  disabled?: boolean;
}) {
  const pick = useRef<HTMLInputElement>(null);
  const shoot = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handle = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const ok: File[] = [];
    for (const f of Array.from(list)) {
      const err = validateImageFile(f);
      if (err) toast.error(`${f.name}: ${err}`);
      else ok.push(f);
    }
    if (ok.length) onFiles(multiple ? ok : ok.slice(0, 1));
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) handle(e.dataTransfer.files);
      }}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md border border-dashed p-3 transition-colors",
        over ? "border-primary bg-primary/5" : "border-input",
        compact ? "justify-start" : "flex-col justify-center p-6 text-center",
      )}
    >
      {!compact && <p className="text-sm text-muted-foreground">{label}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={disabled} className="h-11 sm:h-8" onClick={() => pick.current?.click()}>
          <ImagePlus /> {compact ? "Выбрать фото" : "Выбрать из галереи"}
        </Button>
        <Button type="button" variant="outline" disabled={disabled} className="h-11 sm:h-8" onClick={() => shoot.current?.click()}>
          <Camera /> Снять камерой
        </Button>
      </div>
      <input
        ref={pick}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        multiple={multiple}
        hidden
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={shoot}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
