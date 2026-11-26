"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square, Undo2, X } from "lucide-react";
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
import { useSmartVoice } from "@/components/smart-voice";
import { correctSpeechAction } from "@/app/(app)/cards/voice-actions";
import { cn } from "@/lib/utils";
import { getSpeechProvider, hasVoiceConsent, setVoiceConsent } from "@/lib/speech/registry";
import { ERROR_MESSAGE, type SpeechSession } from "@/lib/speech/types";
import { insertDictation, type InsertMode } from "@/lib/speech/insert";
import { applySpokenPunctuation, joinPhrase, localTidy } from "@/lib/speech/spoken";

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
const AI_CONSENT = "kris.voice.ai.v2";
const hasAiConsent = () => {
  try {
    return localStorage.getItem(AI_CONSENT) === "1";
  } catch {
    return false;
  }
};

/**
 * Text field with dictation. Manual typing always works; the microphone is an addition.
 *  - default mode (ADR-009): transcript preview, inserted only after confirmation;
 *  - smart mode (card sections, ADR-019): each phrase is written into the field immediately and its
 *    spelling/punctuation is then corrected in place. Nothing existing is deleted; every phrase can be undone.
 */
export function VoiceInput({ value, onChange, multiline = true, rows = 4, placeholder, id, disabled, className, format, ...rest }: Props) {
  const smart = useSmartVoice();
  const fieldRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const sessionRef = useRef<SpeechSession | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [interim, setInterim] = useState("");
  const [transcript, setTranscript] = useState("");
  const [consentOpen, setConsentOpen] = useState(false);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [fixing, setFixing] = useState(0);
  const [selRange, setSelRange] = useState({ start: 0, end: 0 });
  // Detected after mount: server and first client render must match (hydration).
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported(getSpeechProvider() !== null), []);

  // Speech callbacks outlive renders: they must always see the newest value / handlers.
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const smartRef = useRef(smart);
  const cursorRef = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
    smartRef.current = smart;
  });

  useEffect(() => {
    if (phase !== "recording") return;
    setSeconds(0);
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      sessionRef.current?.abort();
    };
  }, []);

  const write = (next: string) => {
    valueRef.current = next;
    onChangeRef.current(next);
  };

  /** Smart mode: insert one recognised phrase at the cursor, then replace it with the corrected text. */
  const insertPhrase = async (spoken: string) => {
    const current = valueRef.current;
    const at = Math.min(cursorRef.current, current.length);
    const before = current.slice(0, at);
    const after = current.slice(at);
    let phrase = localTidy(applySpokenPunctuation(spoken), before);
    if (!multiline) phrase = phrase.replace(/\n+/g, " ");
    if (!phrase) return;
    const head = joinPhrase(before, phrase);
    setUndoStack((s) => [...s.slice(-19), current]);
    write(after ? joinPhrase(head, after.replace(/^ /, "")) : head);
    cursorRef.current = head.length;

    if (!smartRef.current.ai) return;
    setFixing((n) => n + 1);
    try {
      const res = await correctSpeechAction({ phrase, context: before, terms: smartRef.current.terms.slice(0, 60) });
      const fixed = res.ok ? res.data.text : null;
      if (!alive.current || !fixed || fixed === phrase) return;
      const now = valueRef.current;
      const i = now.lastIndexOf(phrase);
      if (i < 0) return; // the specialist already edited this phrase: leave their text alone
      const clean = multiline ? fixed : fixed.replace(/\n+/g, " ");
      write(now.slice(0, i) + clean + now.slice(i + phrase.length));
      if (cursorRef.current >= i + phrase.length) cursorRef.current += clean.length - phrase.length;
    } catch {
      /* offline: the locally tidied text stays */
    } finally {
      if (alive.current) setFixing((n) => n - 1);
    }
  };

  const begin = useCallback(() => {
    const provider = getSpeechProvider();
    if (!provider) {
      toast.info(ERROR_MESSAGE["not-supported"]);
      return;
    }
    const el = fieldRef.current;
    const start = el?.selectionStart ?? valueRef.current.length;
    const end = el?.selectionEnd ?? valueRef.current.length;
    setSelRange({ start, end });
    // Dictation continues where the cursor is; a field that was never focused gets text appended.
    cursorRef.current = el && document.activeElement === el ? start : valueRef.current.length;
    setTranscript("");
    setInterim("");
    setPhase("recording");
    sessionRef.current = provider.start({
      lang: "ru-RU",
      onInterim: setInterim,
      onFinal: (t) => {
        if (!t) return;
        if (smartRef.current.enabled) void insertPhrase(t);
        else setTranscript((p) => (p ? `${p} ${t}` : t));
      },
      onError: (code) => toast.error(ERROR_MESSAGE[code]),
      onEnd: () => {
        sessionRef.current = null;
        setInterim("");
        setPhase((p) => (p === "recording" ? (smartRef.current.enabled ? "idle" : "review") : p));
      },
    });
    // insertPhrase only reads refs, so it never goes stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMic = () => {
    if (phase === "recording") {
      sessionRef.current?.stop();
      return;
    }
    const provider = getSpeechProvider();
    if (!provider) {
      toast.info(ERROR_MESSAGE["not-supported"]);
      return;
    }
    const needSpeech = provider.sendsAudioToThirdParty && !hasVoiceConsent();
    const needAi = smart.enabled && smart.ai && !hasAiConsent();
    if (needSpeech || needAi) {
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
    setUndoStack((s) => [...s.slice(-19), value]);
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
          className={cn("pr-12 sm:pr-11", multiline && "min-h-20 resize-y", phase === "recording" && "border-destructive ring-3 ring-destructive/20")}
          aria-label={rest["aria-label"]}
        />
        <button
          type="button"
          // keep the caret in the field so dictation goes exactly where the specialist put it
          onMouseDown={(e) => e.preventDefault()}
          onClick={onMic}
          disabled={disabled}
          aria-label={phase === "recording" ? "Остановить запись" : "Надиктовать"}
          aria-pressed={phase === "recording"}
          title={supported ? "Голосовой ввод" : "Голосовой ввод недоступен в этом браузере"}
          className={cn(
            "absolute right-0.5 top-0.5 grid size-11 place-items-center rounded-md transition-colors sm:right-1.5 sm:top-1.5 sm:size-8",
            phase === "recording"
              ? "bg-destructive text-white"
              : !supported
                ? "text-muted-foreground/40"
                : smart.enabled
                  ? "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-primary",
          )}
        >
          {phase === "recording" ? <Square className="size-3.5 fill-current" /> : <Mic className="size-4" />}
        </button>
      </div>

      {phase === "recording" && (
        <div role="status" aria-live="polite" className="animate-fade-in rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-medium text-destructive">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-destructive" />
            </span>
            Идёт запись · {fmt(seconds)}
            {smart.enabled && (
              <>
                <span className="font-normal text-muted-foreground">
                  {smart.ai ? "· текст пишется в поле и исправляется" : "· текст сразу пишется в поле"}
                </span>
                <Button type="button" size="xs" variant="outline" className="ml-auto" onMouseDown={(e) => e.preventDefault()} onClick={onMic}>
                  <Square className="fill-current" /> Стоп
                </Button>
              </>
            )}
          </div>
          <p className="min-h-5 whitespace-pre-wrap">
            {!smart.enabled && transcript}
            {interim && <span className="text-muted-foreground"> {interim}</span>}
            {!interim && (smart.enabled || !transcript) && <span className="text-muted-foreground">Говорите…</span>}
          </p>
        </div>
      )}

      {fixing > 0 && (
        <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> Исправляю ошибки…
        </p>
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

      {undoStack.length > 0 && phase !== "review" && (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="text-muted-foreground"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const previous = undoStack[undoStack.length - 1];
            write(previous);
            cursorRef.current = previous.length;
            setUndoStack((s) => s.slice(0, -1));
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
              Распознавание речи выполняет сам браузер, и обычно это происходит на серверах его разработчика (например, Google для Chrome).
              {smart.enabled && smart.ai && " Чтобы исправить ошибки, надиктованный текст (не аудио) отправляется в сервис исправления: Claude (Anthropic) или ChatGPT (OpenAI)."} Аудио приложением не сохраняется. Не
              диктуйте фамилии пациентов и другие данные, которые нельзя передавать третьим лицам, либо используйте ручной ввод.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConsentOpen(false)}>
              Ввод вручную
            </Button>
            <Button
              onClick={() => {
                setVoiceConsent(true);
                if (smart.enabled && smart.ai) {
                  try {
                    localStorage.setItem(AI_CONSENT, "1");
                  } catch {
                    /* private mode: ask again next time */
                  }
                }
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
