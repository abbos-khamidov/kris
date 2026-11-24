"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const MESSAGES = [
  "Солнышко, пока ты заботишься о красоте других, не забывай заботиться о себе.",
  "Самая красивая часть этого проекта сейчас смотрит на экран.",
  "Пока ты делаешь людей красивее, я стараюсь сделать твою жизнь немного легче.",
  "Даже за тысячи километров ты остаёшься моим солнышком.",
  "Этот кабинет создан, чтобы у тебя оставалось больше времени на себя. Ну и немного на меня.",
  "Если сегодня был тяжёлый день, просто знай: я горжусь тобой.",
  "Улыбнись. Тебе невероятно идёт.",
  "Здесь автоматизировано почти всё. Кроме того, как сильно я по тебе скучаю.",
  "Ты занимаешься красотой людей, а сама даже не представляешь, насколько красива.",
  "Некоторые проекты создаются ради денег. Этот создавался ради твоей улыбки.",
];

const KEY = "kris.gift.last";
let lastIndex = -1;

/** Random message, never the same one twice in a row (also across page reloads within a session). */
function nextIndex(): number {
  try {
    const stored = sessionStorage.getItem(KEY);
    if (stored !== null) lastIndex = Number(stored);
  } catch {
    /* storage unavailable: module variable still prevents immediate repeats */
  }
  let i: number;
  do {
    i = Math.floor(Math.random() * MESSAGES.length);
  } while (i === lastIndex && MESSAGES.length > 1);
  lastIndex = i;
  try {
    sessionStorage.setItem(KEY, String(i));
  } catch {
    /* ignore */
  }
  return i;
}

function Sun({ className }: { className?: string }) {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className={className} aria-hidden="true">
      <g className="sun-rays">
        {rays.map((deg) => (
          <line key={deg} x1="60" y1="14" x2="60" y2={deg % 90 === 0 ? 24 : 20} transform={`rotate(${deg} 60 60)`} />
        ))}
      </g>
      <circle cx="60" cy="60" r="21" className="sun-core" />
    </svg>
  );
}

/** Small personal gift for the owner. Opens only on click; no description in any user-facing navigation. */
export function SunGift({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  return (
    <>
      <button
        type="button"
        aria-label="Солнце"
        onClick={() => {
          setIndex(nextIndex());
          setOpen(true);
        }}
        className={cn(
          "grid size-8 place-items-center rounded-md text-muted-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-primary",
          className,
        )}
      >
        <Sun className="size-5" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="max-w-sm gap-0 p-8 text-center sm:max-w-sm">
          <Sun className="sun-open mx-auto mb-5 size-20 text-primary" />
          <DialogTitle className="font-serif text-2xl text-primary">Для моего солнышка</DialogTitle>
          <DialogDescription className="sr-only">Личное сообщение</DialogDescription>
          <div className="mx-auto my-4 h-px w-10 bg-primary/30" />
          <p key={index} className="gift-text font-serif text-[17px] leading-relaxed text-foreground">
            {MESSAGES[index]}
          </p>
          <p className="mt-6 text-[11px] italic tracking-wide text-muted-foreground">
            С любовью, от твоего узбека, который похож на казаха
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
