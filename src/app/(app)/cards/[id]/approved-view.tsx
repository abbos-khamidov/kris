"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Download, FilePlus2, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PdfViewer } from "@/components/pdf-viewer";
import { formatDateRu } from "@/lib/format";
import { downloadBlob, sharePdf } from "@/lib/pdf-client/share";
import { createCardAction, documentUrlAction, startNewVersionAction } from "../actions";

interface Version {
  version: number;
  approvedAt: string;
  documentId: string | null;
  fileName: string;
  sizeBytes: number;
}

async function fetchStoredPdf(documentId: string): Promise<{ blob: Blob; fileName: string }> {
  const res = await documentUrlAction(documentId);
  if (!res.ok) throw new Error(res.error);
  const r = await fetch(res.data.url, { cache: "no-store" });
  if (!r.ok) throw new Error("Не удалось загрузить документ");
  return { blob: await r.blob(), fileName: res.data.fileName };
}

/**
 * Approved card: shows the ORIGINAL stored PDF of each version. Nothing here regenerates a document,
 * so later changes to the catalog, settings, photos or patient data can never alter it.
 */
export function ApprovedView({ cardId, patientId, patientName, versions }: { cardId: string; patientId: string; patientName: string; versions: Version[] }) {
  const router = useRouter();
  const latest = versions.at(-1);
  const [shown, setShown] = useState<Version | undefined>(latest);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!shown?.documentId) return;
    let alive = true;
    setBlob(null);
    setError(null);
    fetchStoredPdf(shown.documentId)
      .then((r) => alive && setBlob(r.blob))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Ошибка"));
    return () => {
      alive = false;
    };
  }, [shown]);

  const act = async (v: Version, kind: "download" | "share") => {
    if (!v.documentId) return;
    setBusy(`${kind}-${v.version}`);
    try {
      const { blob: b, fileName } = await fetchStoredPdf(v.documentId);
      if (kind === "download") downloadBlob(b, fileName);
      else {
        const r = await sharePdf(b, fileName);
        if (r === "downloaded") toast.info("Передача файла недоступна на этом устройстве. PDF скачан — отправьте его пациенту вручную.");
        else if (r === "opened") toast.message("Открыто окно отправки. Приложение не знает, был ли файл отправлен.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="animate-fade-in space-y-5 p-4 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/patients/${patientId}?tab=cards`} className="inline-flex min-h-11 items-center text-xs text-muted-foreground hover:text-primary sm:min-h-0">
            ← {patientName}
          </Link>
          <h1 className="mt-1 text-2xl">Карта утверждена</h1>
          <p className="text-sm text-muted-foreground">Документ неизменяем. Для правок создайте новую версию — прежние версии останутся как есть.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="h-11 sm:h-8"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await startNewVersionAction(cardId);
                if (!r.ok) return void toast.error(r.error);
                router.refresh();
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : <FilePlus2 />} Создать новую версию
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:h-8"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await createCardAction(patientId, cardId);
                if (!r.ok) return void toast.error(r.error);
                router.push(`/cards/${r.data.id}`);
              })
            }
          >
            <Copy /> Новая карта на основе этой
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <section aria-label="Версии" className="space-y-2">
          <h2 className="text-lg">Версии</h2>
          <ul className="divide-y rounded-md border bg-surface">
            {[...versions].reverse().map((v) => (
              <li key={v.version} className={`space-y-2 p-3 ${shown?.version === v.version ? "bg-primary/5" : ""}`}>
                <button type="button" className="text-left" onClick={() => setShown(v)}>
                  <p className="text-sm font-medium">Версия {v.version}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateRu(v.approvedAt)} · {Math.round(v.sizeBytes / 1024)} КБ
                  </p>
                </button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-11 sm:h-7" disabled={!v.documentId || busy !== null} onClick={() => act(v, "download")}>
                    {busy === `download-${v.version}` ? <Loader2 className="animate-spin" /> : <Download />} Скачать
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-11 sm:h-7" disabled={!v.documentId || busy !== null} onClick={() => act(v, "share")}>
                    {busy === `share-${v.version}` ? <Loader2 className="animate-spin" /> : <Share2 />} Поделиться
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <PdfViewer blob={blob} error={error} className="h-[75dvh] rounded-md border" />
      </div>
    </div>
  );
}
