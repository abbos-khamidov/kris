"use client";
import { AlertTriangle, Check, CloudOff, Loader2 } from "lucide-react";
import type { SaveStatus } from "@/lib/autosave";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TEXT: Record<SaveStatus, string> = {
  idle: "",
  dirty: "Есть несохранённые изменения",
  saving: "Сохранение…",
  saved: "Сохранено",
  offline: "Нет соединения — сохраним при подключении",
  error: "Не удалось сохранить",
  conflict: "Изменено на другом устройстве",
};

/** "Сохранено" is shown only when the autosave engine saw a server confirmation. */
export function SaveBadge({
  status,
  message,
  onRetry,
  onConflict,
  className,
}: {
  status: SaveStatus;
  message?: string;
  onRetry?: () => void;
  onConflict?: () => void;
  className?: string;
}) {
  if (status === "idle") return null;
  const bad = status === "error" || status === "conflict";
  return (
    <div
      role="status"
      aria-live="polite"
      title={message}
      className={cn(
        "flex items-center gap-1.5 text-xs",
        bad ? "text-destructive" : status === "saved" ? "text-muted-foreground" : "text-foreground/70",
        className,
      )}
    >
      {status === "saving" && <Loader2 className="size-3.5 animate-spin" />}
      {status === "saved" && <Check className="size-3.5" />}
      {status === "offline" && <CloudOff className="size-3.5" />}
      {bad && <AlertTriangle className="size-3.5" />}
      <span>{TEXT[status]}</span>
      {(status === "offline" || status === "error") && onRetry && (
        <Button type="button" variant="link" size="xs" className="h-auto p-0 text-xs" onClick={onRetry}>
          Повторить
        </Button>
      )}
      {status === "conflict" && onConflict && (
        <Button type="button" variant="link" size="xs" className="h-auto p-0 text-xs" onClick={onConflict}>
          Загрузить актуальную версию
        </Button>
      )}
    </div>
  );
}
