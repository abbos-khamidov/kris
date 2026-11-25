"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sha256Hex } from "@/lib/card/hash";
import { formatDateRu } from "@/lib/format";
import { extractPages } from "@/lib/import/extract";
import { parseCard } from "@/lib/import/parse";
import { cn } from "@/lib/utils";
import { saveImportAction, type ImportSummary } from "./actions";

const MAX_BYTES = 30 * 1024 * 1024;

export function ImportManager({ initial }: { initial: ImportSummary[] }) {
  const router = useRouter();
  const pick = useRef<HTMLInputElement>(null);
  const [consent, setConsent] = useState(false);
  const [over, setOver] = useState(false);
  const [log, setLog] = useState<{ name: string; state: "work" | "ok" | "dup" | "err"; msg: string }[]>([]);
  const busy = log.some((l) => l.state === "work");

  const setState = (name: string, state: "work" | "ok" | "dup" | "err", msg: string) =>
    setLog((l) => l.map((x) => (x.name === name ? { ...x, state, msg } : x)));

  const run = async (files: File[]) => {
    const pdfs = files.filter((f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf");
    if (pdfs.length !== files.length) toast.error("Принимаются только PDF-файлы");
    setLog(pdfs.map((f) => ({ name: f.name, state: "work", msg: "Разбор…" })));
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    for (const f of pdfs) {
      try {
        if (f.size > MAX_BYTES) throw new Error("Файл больше 30 МБ");
        const bytes = new Uint8Array(await f.arrayBuffer());
        const hash = await sha256Hex(bytes);
        const task = pdfjs.getDocument({ data: bytes.slice() });
        const doc = await task.promise;
        // Parsing happens in THIS browser; only the structured result is sent to your own database.
        const parsed = parseCard(await extractPages(doc as never));
        void task.destroy();
        const res = await saveImportAction({ fileName: f.name, sourceHash: hash, parsed });
        if (!res.ok) throw new Error(res.error);
        if (res.data.duplicate) setState(f.name, "dup", "Уже импортирован");
        else setState(f.name, "ok", `Найдено: ${res.data.candidates}${res.data.merged ? `, повторов объединено: ${res.data.merged}` : ""}${parsed.unrecognised.length ? `, не распознано страниц: ${parsed.unrecognised.length}` : ""}`);
      } catch (e) {
        setState(f.name, "err", e instanceof Error ? e.message : "Не удалось разобрать файл");
      }
    }
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3 rounded-md border border-amber-600/30 bg-amber-50 p-3 text-sm text-amber-950">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700" />
        <div className="space-y-2">
          <p>
            Карты содержат персональные данные пациентов. Разбор выполняется в вашем браузере, сами PDF не загружаются и нигде не хранятся. Данные пациента из карты сохраняются только внутри импорта и не попадают в библиотеку и каталог. Удалите импорт после проверки.
          </p>
          <label className="flex min-h-11 items-center gap-2 sm:min-h-0">
            <input type="checkbox" className="size-4 accent-primary" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            Я понимаю это и имею право обрабатывать эти документы
          </label>
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (consent && !busy) void run(Array.from(e.dataTransfer.files));
        }}
        className={cn("flex flex-col items-center gap-3 rounded-md border border-dashed p-8 text-center transition-colors", over ? "border-primary bg-primary/5" : "border-input", !consent && "opacity-50")}
      >
        <FileUp className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Перетащите PDF-карты сюда (можно много файлов) или выберите на устройстве</p>
        <Button type="button" disabled={!consent || busy} className="h-11 sm:h-8" onClick={() => pick.current?.click()}>
          {busy ? <Loader2 className="animate-spin" /> : <FileUp />} Выбрать PDF
        </Button>
        <input
          ref={pick}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => {
            void run(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {log.length > 0 && (
        <ul className="divide-y rounded-md border bg-surface text-sm">
          {log.map((l) => (
            <li key={l.name} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="truncate">{l.name}</span>
              <span className={cn("shrink-0 text-xs", l.state === "err" ? "text-destructive" : l.state === "ok" ? "text-green-800" : "text-muted-foreground")}>
                {l.state === "work" && <Loader2 className="mr-1 inline size-3 animate-spin" />}
                {l.msg}
              </span>
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-3">
        <h2 className="text-lg">Импортированные карты</h2>
        {initial.length === 0 ? (
          <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">Импортов пока нет.</p>
        ) : (
          <ul className="divide-y rounded-md border bg-surface">
            {initial.map((i) => (
              <li key={i.id}>
                <Link href={`/import/${i.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-secondary/60">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{i.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateRu(i.importedAt)} · {i.pages} стр.
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    <p className={i.pending > 0 ? "text-amber-800" : "text-green-800"}>{i.pending > 0 ? `Ждёт проверки: ${i.pending}` : "Проверено"}</p>
                    <p className="text-muted-foreground">всего {i.candidates}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
