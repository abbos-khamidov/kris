"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Maximize2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shows the pages of the REAL generated PDF (rasterised with pdf.js, which also works on iOS where PDFs
 * cannot be embedded). Always light, regardless of the site theme. Zoom with the buttons, ctrl+wheel or
 * a two-finger pinch (the scroll area allows native pinch-zoom).
 */
export function PdfViewer({
  blob,
  busy,
  className,
  error,
}: {
  blob: Blob | null;
  busy?: boolean;
  className?: string;
  error?: string | null;
}) {
  const host = useRef<HTMLDivElement>(null);
  const canvases = useRef<HTMLCanvasElement[]>([]);
  // The document itself is state: an edited card often has the same page count and must still redraw.
  const [doc, setDoc] = useState<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(1);
  const [width, setWidth] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [failed, setFailed] = useState(false);
  const taskRef = useRef<import("pdfjs-dist").PDFDocumentLoadingTask | null>(null);
  const pages = doc?.numPages ?? 0;

  useEffect(() => () => void taskRef.current?.destroy(), []);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.floor(el.clientWidth)));
    ro.observe(el);
    setWidth(Math.floor(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  // Load the document whenever a new blob arrives. The previous one stays on screen until then.
  useEffect(() => {
    if (!blob) return;
    let alive = true;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const data = new Uint8Array(await blob.arrayBuffer());
      const task = pdfjs.getDocument({ data });
      const next = await task.promise;
      if (!alive) return void task.destroy();
      const previous = taskRef.current;
      taskRef.current = task;
      setFailed(false);
      setDoc(next);
      void previous?.destroy();
    })().catch(() => {
      if (alive) setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [blob]);

  // Each page is painted on a fresh off-screen canvas and then copied: a newer run (zoom, resize, new
  // document) never shares a canvas with an unfinished one, and the old picture does not flicker away.
  useEffect(() => {
    if (!doc || width < 100) return;
    let cancelled = false;
    let task: import("pdfjs-dist").RenderTask | null = null;
    setRendering(true);
    (async () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (let n = 1; n <= doc.numPages && !cancelled; n++) {
        const page = await doc.getPage(n);
        const target = canvases.current[n - 1];
        if (cancelled || !target) continue;
        const scale = ((width - 16) * zoom) / page.getViewport({ scale: 1 }).width;
        const viewport = page.getViewport({ scale: scale * dpr });
        const buffer = document.createElement("canvas");
        buffer.width = Math.floor(viewport.width);
        buffer.height = Math.floor(viewport.height);
        task = page.render({ canvas: buffer, canvasContext: buffer.getContext("2d")!, viewport });
        await task.promise;
        if (cancelled) return;
        target.width = buffer.width;
        target.height = buffer.height;
        target.style.width = `${Math.floor(viewport.width / dpr)}px`;
        target.style.height = `${Math.floor(viewport.height / dpr)}px`;
        target.getContext("2d")!.drawImage(buffer, 0, 0);
        target.dataset.rendered = "true";
        // iOS keeps canvas memory until the size is released.
        buffer.width = buffer.height = 0;
      }
    })()
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, width, zoom]);

  // Track the visible page.
  const onScroll = () => {
    const el = host.current;
    if (!el) return;
    const mid = el.scrollTop + el.clientHeight / 3;
    let idx = 1;
    canvases.current.forEach((c, i) => {
      if (c && c.offsetTop - 8 <= mid) idx = i + 1;
    });
    setCurrent(idx);
  };

  const go = (n: number) => {
    const c = canvases.current[Math.min(Math.max(n, 1), pages) - 1];
    c?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className={cn("flex min-h-0 flex-col bg-[#e7e2de]", className)}>
      <div className="flex items-center justify-between gap-2 border-b bg-white px-2 py-1.5 text-xs text-neutral-700">
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-8" aria-label="Предыдущая страница" onClick={() => go(current - 1)} disabled={current <= 1}>
            <ChevronLeft />
          </Button>
          <span className="min-w-14 text-center tabular-nums" aria-live="polite">
            {pages ? `${current} / ${pages}` : "—"}
          </span>
          <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-8" aria-label="Следующая страница" onClick={() => go(current + 1)} disabled={current >= pages}>
            <ChevronRight />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          {(busy || rendering) && <Loader2 className="size-3.5 animate-spin" aria-label="Обновление" />}
          <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-8" aria-label="Уменьшить" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}>
            <Minus />
          </Button>
          <span className="w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-8" aria-label="Увеличить" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}>
            <Plus />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-8" aria-label="По ширине" onClick={() => setZoom(1)}>
            <Maximize2 />
          </Button>
        </div>
      </div>
      <div
        ref={host}
        onScroll={onScroll}
        onWheel={(e) => {
          if (e.ctrlKey) {
            e.preventDefault();
            setZoom((z) => Math.min(3, Math.max(0.5, +(z - e.deltaY * 0.002).toFixed(2))));
          }
        }}
        className="min-h-0 flex-1 overflow-auto p-2"
        style={{ touchAction: "pan-x pan-y pinch-zoom", scrollbarGutter: "stable" }}
      >
        {error && <p className="p-4 text-center text-sm text-red-700">{error}</p>}
        {failed && !error && <p className="p-4 text-center text-sm text-red-700">Не удалось показать предпросмотр. Измените масштаб или обновите страницу — скачивание PDF работает.</p>}
        {!blob && !error && (
          <div className="grid h-full min-h-64 place-items-center text-sm text-neutral-600">
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Готовим предпросмотр…
            </span>
          </div>
        )}
        <div className="mx-auto flex w-max flex-col gap-3">
          {Array.from({ length: pages }, (_, i) => (
            <canvas
              key={i}
              ref={(el) => {
                if (el) canvases.current[i] = el;
              }}
              className="bg-white shadow-md"
              aria-label={`Страница ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
