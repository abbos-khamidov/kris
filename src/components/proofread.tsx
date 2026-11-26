"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Part } from "@/lib/text/safe-diff";

/** The button appears only where a provider switches it on (the sections of the patient card). */
const Ctx = createContext(false);
export const ProofreadProvider = ({ enabled, children }: { enabled: boolean; children: React.ReactNode }) => <Ctx.Provider value={enabled}>{children}</Ctx.Provider>;

interface Result {
  source: string;
  corrected: string;
  parts: Part[];
  count: number;
  rejected: number;
}

type State = { phase: "idle" } | { phase: "confirm" } | { phase: "loading" } | { phase: "error"; message: string } | { phase: "result"; result: Result };

const CONSENT = "kris.proofread.v1";
const consented = () => {
  try {
    return localStorage.getItem(CONSENT) === "1";
  } catch {
    return false;
  }
};

/** «Проверить текст»: runs only on click; nothing changes until the specialist accepts. */
export function Proofread({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const enabled = useContext(Ctx);
  const [state, setState] = useState<State>({ phase: "idle" });
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  if (!enabled || (state.phase === "idle" && (value.match(/\p{L}/gu)?.length ?? 0) < 3)) return null;

  const run = async () => {
    abort.current?.abort();
    const controller = (abort.current = new AbortController());
    const source = value;
    setState({ phase: "loading" });
    try {
      const res = await fetch("/api/proofread", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: source }),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => null)) as (Partial<Result> & { error?: string }) | null;
      if (!res.ok || !data || typeof data.corrected !== "string") {
        setState({ phase: "error", message: data?.error ?? "Не удалось проверить текст. Повторите попытку." });
        return;
      }
      setState({ phase: "result", result: { source, corrected: data.corrected, parts: data.parts ?? [], count: data.count ?? 0, rejected: data.rejected ?? 0 } });
    } catch {
      if (!controller.signal.aborted) setState({ phase: "error", message: "Нет связи с сервером. Проверьте интернет и повторите." });
    }
  };

  const close = () => {
    abort.current?.abort();
    setState({ phase: "idle" });
  };

  const stale = state.phase === "result" && state.result.source !== value;

  return (
    <div className="space-y-2" data-proofread>
      {(state.phase === "idle" || state.phase === "loading") && (
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="text-muted-foreground hover:text-primary"
            disabled={state.phase === "loading"}
            onClick={() => (consented() ? void run() : setState({ phase: "confirm" }))}
          >
            {state.phase === "loading" ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {state.phase === "loading" ? "Проверяю…" : "Проверить текст"}
          </Button>
          {state.phase === "loading" && (
            <Button type="button" size="xs" variant="ghost" onClick={close}>
              Отмена
            </Button>
          )}
        </div>
      )}

      {state.phase === "confirm" && (
        <div className="space-y-2 rounded-md border bg-secondary/50 p-3 text-sm">
          <p>Текст поля будет отправлен в OpenAI для проверки. Имена пациентов, телефоны, e-mail и даты приложение перед этим скрывает, но другие личные сведения в свободном тексте может не распознать.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                try {
                  localStorage.setItem(CONSENT, "1");
                } catch {
                  /* private mode: ask again next time */
                }
                void run();
              }}
            >
              Согласен, проверить
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={close}>
              Отмена
            </Button>
          </div>
        </div>
      )}

      {state.phase === "error" && (
        <div role="alert" className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p>{state.message}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void run()}>
              Повторить
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={close}>
              Закрыть
            </Button>
          </div>
        </div>
      )}

      {state.phase === "result" && (
        <div role="status" className="space-y-2 rounded-md border bg-secondary/50 p-3 text-sm">
          <p className="text-xs font-medium text-muted-foreground">
            {state.result.count ? `Исправлений: ${state.result.count}` : "Ошибок не найдено"}
            {state.result.rejected > 0 && ` · отклонено небезопасных правок: ${state.result.rejected}`}
          </p>
          {state.result.count > 0 && (
            <p className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words" data-proofread-text>
              {state.result.parts.map((part, i) =>
                "text" in part ? (
                  <span key={i}>{part.text}</span>
                ) : (
                  <span key={i}>
                    {part.from.trim() && <del className="text-destructive/80">{part.from}</del>}
                    <ins className="rounded-sm bg-primary/15 no-underline">{part.to}</ins>
                  </span>
                ),
              )}
            </p>
          )}
          {stale && <p className="text-xs text-destructive">Текст изменился после проверки — проверьте его заново.</p>}
          <div className="flex flex-wrap gap-2">
            {state.result.count > 0 && !stale && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onChange(state.result.corrected);
                  close();
                }}
              >
                <Check /> Принять
              </Button>
            )}
            {stale && (
              <Button type="button" size="sm" onClick={() => void run()}>
                <Sparkles /> Проверить заново
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={close}>
              <X /> {state.result.count > 0 ? "Отклонить" : "Закрыть"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
