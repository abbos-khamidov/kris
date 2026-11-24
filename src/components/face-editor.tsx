"use client";
import { useRef, useState } from "react";
import { Eraser, ImagePlus, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Stroke } from "@/lib/schemas/card";
import { uid } from "@/lib/schemas/common";
import { cn } from "@/lib/utils";

const COLORS = { green: "#6AB54A", red: "#D93A3A" } as const;
const MIN_STEP = 0.004;

/**
 * Draw allowed (green) and excluded (red) zones over the face illustration. Coordinates are stored
 * normalised (0..1) and separately from the image, so any illustration can be swapped under them.
 * Works with mouse, touch and Apple Pencil / stylus (pointer events; palm rejection once a pen is seen).
 */
export function FaceEditor({
  imageUrl,
  strokes,
  onChange,
  onPickIllustration,
}: {
  imageUrl: string | null;
  strokes: Stroke[];
  onChange: (next: Stroke[]) => void;
  onPickIllustration?: () => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [color, setColor] = useState<Stroke["color"]>("green");
  const [live, setLive] = useState<Stroke | null>(null);
  const penSeen = useRef(false);
  const active = useRef<number | null>(null);

  const pt = (e: React.PointerEvent): [number, number] => {
    const r = svg.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };

  const down = (e: React.PointerEvent) => {
    if (e.pointerType === "pen") penSeen.current = true;
    if (penSeen.current && e.pointerType === "touch") return; // palm rejection
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    active.current = e.pointerId;
    const p = pt(e);
    setLive({ id: uid(), color, width: 0.012, points: [p, p] });
  };
  const moveEv = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId || !live) return;
    const p = pt(e);
    const last = live.points[live.points.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < MIN_STEP) return;
    setLive({ ...live, points: [...live.points, p] });
  };
  const up = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId) return;
    active.current = null;
    if (live && live.points.length >= 2) onChange([...strokes, live]);
    setLive(null);
  };

  const all = live ? [...strokes, live] : strokes;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["green", "red"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-pressed={color === c}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm sm:min-h-8",
              color === c ? "border-primary bg-primary/5 font-medium" : "border-input bg-surface",
            )}
          >
            <span className="h-1 w-6 rounded-full" style={{ background: COLORS[c] }} />
            {c === "green" ? "Зона нанесения" : "Не наносить"}
          </button>
        ))}
        <Button type="button" variant="outline" className="h-11 sm:h-8" disabled={strokes.length === 0} onClick={() => onChange(strokes.slice(0, -1))}>
          <Undo2 /> Отменить
        </Button>
        <Button type="button" variant="outline" className="h-11 sm:h-8" disabled={strokes.length === 0} onClick={() => onChange([])}>
          <Eraser /> Очистить
        </Button>
        {onPickIllustration && (
          <Button type="button" variant="outline" className="h-11 sm:h-8" onClick={onPickIllustration}>
            <ImagePlus /> Другая иллюстрация
          </Button>
        )}
      </div>
      <div className="relative mx-auto aspect-square w-full max-w-sm select-none overflow-hidden rounded-2xl bg-secondary">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="Иллюстрация лица" className="absolute inset-0 size-full object-cover" draggable={false} />
        ) : (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-muted-foreground">
            Иллюстрация лица не задана. Загрузите её в «Настройки → Фирменные изображения».
          </p>
        )}
        <svg
          ref={svg}
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full cursor-crosshair"
          style={{ touchAction: "none" }}
          onPointerDown={down}
          onPointerMove={moveEv}
          onPointerUp={up}
          onPointerCancel={up}
          role="img"
          aria-label="Область рисования схемы нанесения"
        >
          {all.map((s) => (
            <polyline
              key={s.id}
              points={s.points.map(([x, y]) => `${x},${y}`).join(" ")}
              stroke={COLORS[s.color]}
              strokeWidth={s.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </svg>
      </div>
      <p className="text-xs text-muted-foreground">Рисуйте пальцем, мышью или стилусом. Линии сохраняются отдельно от иллюстрации.</p>
    </div>
  );
}
