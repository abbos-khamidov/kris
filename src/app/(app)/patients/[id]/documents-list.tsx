"use client";
import { useState } from "react";
import Link from "next/link";
import { Download, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDateRu } from "@/lib/format";
import { downloadBlob, sharePdf } from "@/lib/pdf-client/share";
import { documentUrlAction } from "../../cards/actions";

interface Doc {
  id: string;
  cardId: string;
  version: number;
  fileName: string;
  size: number;
  createdAt: string;
}

/** Stored ORIGINAL PDFs of every approved version (never regenerated). */
export function DocumentsList({ docs }: { docs: Doc[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (d: Doc, kind: "download" | "share") => {
    setBusy(`${kind}${d.id}`);
    try {
      const res = await documentUrlAction(d.id);
      if (!res.ok) throw new Error(res.error);
      const r = await fetch(res.data.url, { cache: "no-store" });
      if (!r.ok) throw new Error("Не удалось загрузить документ");
      const blob = await r.blob();
      if (kind === "download") downloadBlob(blob, res.data.fileName);
      else {
        const s = await sharePdf(blob, res.data.fileName);
        if (s === "downloaded") toast.info("Передача файла недоступна на этом устройстве. PDF скачан — отправьте его вручную.");
        else if (s === "opened") toast.message("Открыто окно отправки. Приложение не знает, был ли файл отправлен.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  };

  if (docs.length === 0) return <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">Утверждённых документов пока нет.</p>;
  return (
    <ul className="divide-y rounded-md border bg-surface">
      {docs.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{d.fileName}</p>
            <p className="text-xs text-muted-foreground">
              Версия {d.version} · {formatDateRu(d.createdAt)} · {Math.round(d.size / 1024)} КБ ·{" "}
              <Link href={`/cards/${d.cardId}`} className="text-primary underline underline-offset-2">
                открыть карту
              </Link>
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="h-11 sm:h-7" disabled={busy !== null} onClick={() => run(d, "download")}>
              {busy === `download${d.id}` ? <Loader2 className="animate-spin" /> : <Download />} Скачать
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-11 sm:h-7" disabled={busy !== null} onClick={() => run(d, "share")}>
              {busy === `share${d.id}` ? <Loader2 className="animate-spin" /> : <Share2 />} Поделиться
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
