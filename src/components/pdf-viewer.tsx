"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(1);
  const [width, setWidth] = useState(0);
  const [rendering, setRendering] = useState(false);
  const docRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const taskRef = useRef<import("pdfjs-dist").PDFDocumentLoadingTask | null>(null);
  const token = useRef(0);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.floor(el.clientWidth)));
    ro.observe(el);
    setWidth(Math.floor(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  // Load the document whenever a new blob arrives.
  useEffect(() => {
    if (!blob) return;
    let alive = true;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const data = new Uint8Array(await blob.arrayBuffer());
      const task = pdfjs.getDocument({ data });
      const doc = await task.promise;
      if (!alive) return void task.destroy();
      const prev = taskRef.current;
      taskRef.current = task;
      docRef.current = doc;
      setPages(doc.numPages);
      void prev?.destroy();
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [blob]);

  const draw = useCallback(async () => {
    const doc = docRef.current;
    if (!doc || width < 100) return;
    const mine = ++token.current;
    setRendering(true);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (let n = 1; n <= doc.numPages; n++) {
      const canvas = canvases.current[n - 1];
      if (!canvas) continue;
      const page = await doc.getPage(n);
      if (mine !== token.current) return;
      const base = page.getViewport({ scale: 1 });
      const scale = ((width - 16) * zoom) / base.width;
      const vp = page.getViewport({ scale: scale * dpr });
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      canvas.style.width = `${Math.floor(vp.width / dpr)}px`;
      canvas.style.height = `${Math.floor(vp.height / dpr)}px`;
      await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
    }
    if (mine === token.current) setRendering(false);
  }, [width, zoom]);

  useEffect(() => {
    void draw();
  }, [draw, pages]);

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
        style={{ touchAction: "pan-x pan-y pinch-zoom" }}
      >
        {error && <p className="p-4 text-center text-sm text-red-700">{error}</p>}
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
