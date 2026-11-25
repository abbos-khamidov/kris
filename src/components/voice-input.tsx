"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getSpeechProvider, hasVoiceConsent, setVoiceConsent } from "@/lib/speech/registry";
import { ERROR_MESSAGE, type SpeechSession } from "@/lib/speech/types";
import { insertDictation, type InsertMode } from "@/lib/speech/insert";

type Phase = "idle" | "recording" | "review";

interface Props {
  value: string;
  onChange: (next: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  /** Shows **bold** / ==highlight== / !!important!! buttons that wrap the selected text. */
  format?: boolean;
}

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/**
 * Text field with dictation (ADR-009). Manual typing always works; the microphone is an addition.
 * Nothing is inserted until the specialist confirms the transcript, and the last insertion can be undone.
 */
export function VoiceInput({ value, onChange, multiline = true, rows = 4, placeholder, id, disabled, className, format, ...rest }: Props) {
  const fieldRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const sessionRef = useRef<SpeechSession | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [interim, setInterim] = useState("");
  const [transcript, setTranscript] = useState("");
  const [consentOpen, setConsentOpen] = useState(false);
  const [undo, setUndo] = useState<string | null>(null);
  const [selRange, setSelRange] = useState({ start: 0, end: 0 });
  // Detected after mount: server and first client render must match (hydration).
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported(getSpeechProvider() !== null), []);

  useEffect(() => {
    if (phase !== "recording") return;
    setSeconds(0);
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => () => sessionRef.current?.abort(), []);

  const begin = useCallback(() => {
    const provider = getSpeechProvider();
    if (!provider) {
      toast.info(ERROR_MESSAGE["not-supported"]);
      return;
    }
    const el = fieldRef.current;
    setSelRange({ start: el?.selectionStart ?? value.length, end: el?.selectionEnd ?? value.length });
    setTranscript("");
    setInterim("");
    setPhase("recording");
    sessionRef.current = provider.start({
      lang: "ru-RU",
      onInterim: setInterim,
      onFinal: (t) => t && setTranscript((p) => (p ? `${p} ${t}` : t)),
      onError: (code) => toast.error(ERROR_MESSAGE[code]),
      onEnd: () => {
        sessionRef.current = null;
        setInterim("");
        setPhase((p) => (p === "recording" ? "review" : p));
      },
    });
  }, [value.length]);

  const onMic = () => {
    if (phase === "recording") {
      sessionRef.current?.stop();
      return;
    }
    if (!getSpeechProvider()) {
      toast.info(ERROR_MESSAGE["not-supported"]);
      return;
    }
    if (getSpeechProvider()!.sendsAudioToThirdParty && !hasVoiceConsent()) {
      setConsentOpen(true);
      return;
    }
    begin();
  };

  const apply = (mode: InsertMode) => {
    const res = insertDictation(value, transcript, mode, selRange.start, selRange.end, multiline);
    if (res.value === value) {
      setPhase("idle");
      return;
    }
    setUndo(value);
    onChange(res.value);
    setPhase("idle");
    setTranscript("");
    requestAnimationFrame(() => {
      const el = fieldRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(res.caret, res.caret);
      }
    });
  };

  const wrap = (mark: string) => {
    const el = fieldRef.current;
    if (!el) return;
    const a = el.selectionStart ?? 0;
    const b = el.selectionEnd ?? 0;
    if (a === b) return void el.focus();
    const next = `${value.slice(0, a)}${mark}${value.slice(a, b)}${mark}${value.slice(b)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + mark.length, b + mark.length);
    });
  };

  const selected = value.slice(selRange.start, selRange.end);
  const Field = multiline ? Textarea : Input;

  return (
    <div className={cn("space-y-2", className)}>
      {format && (
        <div className="flex gap-1" role="toolbar" aria-label="Форматирование">
          {(
            [
              ["**", "Ж", "Жирный (выделите текст)", "font-bold"],
              ["==", "Цвет", "Бордовое выделение", "text-primary font-semibold"],
              ["!!", "!", "Важное", "text-destructive font-bold"],
            ] as const
          ).map(([mark, label, title, cls]) => (
            <button
              key={mark}
              type="button"
              title={title}
              aria-label={title}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => wrap(mark)}
              className={cn("h-11 min-w-11 rounded border border-input bg-surface px-2 text-xs hover:border-primary/50 sm:h-7 sm:min-w-8", cls)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <Field
          ref={fieldRef as never}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          {...(multiline ? { rows } : {})}
          className={cn("pr-12 sm:pr-11", multiline && "min-h-20 resize-y")}
          aria-label={rest["aria-label"]}
        />
        <button
          type="button"
          onClick={onMic}
          disabled={disabled}
          aria-label={phase === "recording" ? "Остановить запись" : "Надиктовать"}
          aria-pressed={phase === "recording"}
          title={supported ? "Голосовой ввод" : "Голосовой ввод недоступен в этом браузере"}
          className={cn(
            "absolute right-0.5 top-0.5 grid size-11 place-items-center rounded-md transition-colors sm:right-1.5 sm:top-1.5 sm:size-8",
            phase === "recording"
              ? "bg-destructive text-white"
              : supported
                ? "text-muted-foreground hover:bg-secondary hover:text-primary"
                : "text-muted-foreground/40",
          )}
        >
          {phase === "recording" ? <Square className="size-3.5 fill-current" /> : <Mic className="size-4" />}
        </button>
      </div>

      {phase === "recording" && (
        <div role="status" aria-live="polite" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-destructive">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-destructive" />
            </span>
            Идёт запись · {fmt(seconds)}
          </div>
          <p className="min-h-5 whitespace-pre-wrap">
            {transcript}
            {interim && <span className="text-muted-foreground"> {interim}</span>}
            {!transcript && !interim && <span className="text-muted-foreground">Говорите…</span>}
          </p>
        </div>
      )}

      {phase === "review" && (
        <div className="space-y-2 rounded-md border bg-secondary/50 p-3">
          <p className="text-xs font-medium text-muted-foreground">Расшифровка — проверьте и при необходимости отредактируйте</p>
          <Textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={3}
            placeholder="Речь не распознана"
            aria-label="Расшифровка голосового ввода"
          />
          {selected && (
            <p className="text-xs text-muted-foreground">
              Будет заменено выделенное: «{selected.length > 80 ? `${selected.slice(0, 80)}…` : selected}»
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => apply("cursor")} disabled={!transcript.trim()}>
              Вставить в курсор
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => apply("append")} disabled={!transcript.trim()}>
              Добавить в конец
            </Button>
            {selected && (
              <Button type="button" size="sm" variant="outline" onClick={() => apply("replace")} disabled={!transcript.trim()}>
                Заменить выделенное
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={() => setPhase("idle")}>
              <X /> Отмена
            </Button>
          </div>
        </div>
      )}

      {undo !== null && phase === "idle" && (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => {
            onChange(undo);
            setUndo(null);
          }}
        >
          <Undo2 /> Отменить последний голосовой ввод
        </Button>
      )}

      <Dialog open={consentOpen} onOpenChange={setConsentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Голосовой ввод</DialogTitle>
            <DialogDescription>
              Распознавание речи выполняет сам браузер, и обычно это происходит на серверах его разработчика (например, Google для
              Chrome). Аудио приложением не сохраняется. Не диктуйте данные, которые нельзя передавать третьим лицам, либо
              используйте ручной ввод.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConsentOpen(false)}>
              Ввод вручную
            </Button>
            <Button
              onClick={() => {
                setVoiceConsent(true);
                setConsentOpen(false);
                begin();
              }}
            >
              Согласен, начать запись
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
