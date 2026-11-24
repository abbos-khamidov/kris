"use client";
import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { processImage, toDecodable, type ProcessedImage } from "@/lib/media/process";

/**
 * Crop / rotate / zoom. `aspect` locks the frame to the slot it will fill in the PDF, so the result
 * keeps its proportions there. Pixels are never filtered or enhanced.
 */
export function ImageCropDialog({
  file,
  aspect,
  title,
  keepPng,
  onCancel,
  onDone,
}: {
  file: File | null;
  aspect?: number;
  title: string;
  keepPng?: boolean;
  onCancel: () => void;
  onDone: (img: ProcessedImage) => Promise<void> | void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    let url: string | null = null;
    let alive = true;
    setError(null);
    toDecodable(file)
      .then((b) => {
        if (!alive) return;
        setBlob(b);
        url = URL.createObjectURL(b);
        setSrc(url);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setRotation(0);
      })
      .catch(() => alive && setError("Не удалось открыть изображение"));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
      setSrc(null);
      setBlob(null);
    };
  }, [file]);

  const onComplete = useCallback((_: Area, px: Area) => setArea(px), []);

  const apply = async () => {
    if (!blob || !area) return;
    setBusy(true);
    try {
      const out = await processImage(blob, { crop: area, rotation, keepPng });
      await onDone(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent className="max-w-xl gap-3 p-4 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
        </DialogHeader>
        <div className="relative h-[55vh] min-h-64 overflow-hidden rounded-md bg-neutral-900">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onComplete}
              objectFit="contain"
            />
          )}
          {!src && !error && <Loader2 className="absolute inset-0 m-auto size-6 animate-spin text-white" />}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <label className="flex flex-1 items-center gap-2 text-xs text-muted-foreground">
            Масштаб
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-11 flex-1 accent-primary sm:h-6"
              aria-label="Масштаб"
            />
          </label>
          <Button type="button" variant="outline" className="h-11 sm:h-8" onClick={() => setRotation((r) => (r + 90) % 360)}>
            <RotateCw /> Повернуть
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy} className="h-11 sm:h-8">
            Отмена
          </Button>
          <Button type="button" onClick={apply} disabled={busy || !area} className="h-11 sm:h-8">
            {busy && <Loader2 className="animate-spin" />}
            Применить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
