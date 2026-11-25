"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Eye, FileCheck2, Loader2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Save, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MediaPicker } from "@/components/media-picker";
import { PatientPhotoPicker } from "@/components/patient-photo-picker";
import { PdfViewer } from "@/components/pdf-viewer";
import { SaveBadge } from "@/components/save-badge";
import { SmartVoiceProvider } from "@/components/smart-voice";
import { useAutosave } from "@/hooks/use-autosave";
import { useMediaQuery } from "@/hooks/use-media-query";
import { SaveError } from "@/lib/autosave";
import { docHash, sha256Hex } from "@/lib/card/hash";
import type { DocContext } from "@/lib/card/resolve";
import { validateCard } from "@/lib/card/validate";
import { pdfFileName } from "@/lib/format";
import { renderPdfBlob, snapshotFor, loadAssetsAsDataUrls } from "@/lib/pdf-client/generate";
import { downloadBlob, sharePdf } from "@/lib/pdf-client/share";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { PAGE_KEYS, PAGE_TITLES, productLine, type CardData, type PageKey } from "@/lib/schemas/card";
import { cn } from "@/lib/utils";
import {
  finalizeApprovalAction,
  prepareApprovalAction,
  refreshPersonalAction,
  saveCardAction,
  saveUiPrefsAction,
} from "../actions";
import {
  ActivesSection,
  CareSection,
  CoverSection,
  ConclusionSection,
  ExtraSection,
  NutritionSection,
  PersonalSection,
  ProceduresSection,
  ProductsSection,
  SkinSection,
  VitaminsSection,
  type Patch,
  type SectionProps,
} from "./sections";

type SectionKey = PageKey | "extra" | "review";
const SECTIONS: { key: SectionKey; label: string }[] = [
  ...PAGE_KEYS.map((k) => ({ key: k as SectionKey, label: PAGE_TITLES[k] })),
  { key: "extra", label: "Дополнительные страницы" },
  { key: "review", label: "Проверка и утверждение" },
];

type View = "sections" | "edit" | "pdf";
type PickerCategory = "brand" | "product" | "specialist" | "patient" | "illustration";

export function CardEditor({
  cardId,
  patientId,
  initial,
  updatedAt,
  docCtx,
  lastSection,
  versions,
}: {
  cardId: string;
  patientId: string;
  initial: CardData;
  updatedAt: string;
  docCtx: DocContext;
  lastSection: string | null;
  versions: number;
}) {
  const router = useRouter();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [card, setCard] = useState<CardData>(initial);
  const [section, setSection] = useState<SectionKey>(SECTIONS.some((s) => s.key === lastSection) ? (lastSection as SectionKey) : "cover");
  const [view, setView] = useState<View>("sections");
  const [navOpen, setNavOpen] = useState(true);
  const [pdfOpen, setPdfOpen] = useState(true);
  const [pdfWidth, setPdfWidth] = useState(440);
  const token = useRef(updatedAt);
  const cardRef = useRef(card);
  cardRef.current = card;

  /* -------------------------------------------------- autosave (server-confirmed) */
  const autosave = useAutosave<CardData>(async (value) => {
    let res;
    try {
      res = await saveCardAction(cardId, value, token.current);
    } catch {
      throw new SaveError("network");
    }
    if (!res.ok) throw new SaveError(res.code === "conflict" ? "conflict" : "server", res.error);
    token.current = res.data.updatedAt;
  });

  const patch: Patch = useCallback(
    (fn) => {
      const next = structuredClone(cardRef.current);
      fn(next);
      cardRef.current = next;
      setCard(next);
      autosave.update(next);
    },
    [autosave],
  );

  /* -------------------------------------------------- last open section, synced across devices */
  useEffect(() => {
    const t = setTimeout(() => void saveUiPrefsAction({ lastSection: { [cardId]: section } }), 1200);
    return () => clearTimeout(t);
  }, [section, cardId]);

  /* -------------------------------------------------- preview: the real PDF, same renderer as download */
  const [blob, setBlob] = useState<Blob | null>(null);
  const [pdfBusy, setPdfBusy] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const run = useRef(0);
  const needPreview = desktop ? pdfOpen : view === "pdf";

  useEffect(() => {
    if (!needPreview) return;
    const mine = ++run.current;
    setPdfBusy(true);
    const t = setTimeout(async () => {
      try {
        const b = await renderPdfBlob(await snapshotFor(docCtx, card));
        if (mine !== run.current) return;
        setBlob(b);
        setPdfError(null);
      } catch (e) {
        if (mine === run.current) setPdfError(e instanceof Error ? e.message : "Не удалось построить предпросмотр");
      } finally {
        if (mine === run.current) setPdfBusy(false);
      }
    }, blob ? 900 : 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, needPreview, docCtx]);

  /* -------------------------------------------------- media picker */
  const [picker, setPicker] = useState<{ category: PickerCategory; done: (id: string) => void } | null>(null);
  const pickImage: SectionProps["pickImage"] = (category, done) => setPicker({ category, done });

  const overrideFace = card.design.imageOverrides.face_illustration;
  const faceId = overrideFace ?? docCtx.brandIds.face_illustration ?? null;
  const [faceUrl, setFaceUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!faceId) return void setFaceUrl(null);
    loadAssetsAsDataUrls([faceId]).then((m) => alive && setFaceUrl((m[faceId] as string) ?? null)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [faceId]);

  /* -------------------------------------------------- navigation + hotkeys */
  const idx = SECTIONS.findIndex((s) => s.key === section);
  const go = useCallback((d: number) => {
    const n = Math.min(SECTIONS.length - 1, Math.max(0, idx + d));
    setSection(SECTIONS[n].key);
    window.scrollTo({ top: 0 });
  }, [idx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveDraft();
      } else if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (mod && e.key === "\\") {
        e.preventDefault();
        setPdfOpen((v) => !v);
      } else if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setNavOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go]);

  /* -------------------------------------------------- actions */
  const fileName = pdfFileName(card.personal.fullName || docCtx.patient.fullName);

  async function saveDraft() {
    await autosave.flush();
    // The toast says "saved" only if the engine really ended in a confirmed state.
    if (!autosave.hasPending()) toast.success("Черновик сохранён");
  }

  const currentBlob = async () => {
    if (blob && !pdfBusy) return blob;
    return renderPdfBlob(await snapshotFor(docCtx, cardRef.current));
  };

  const [busy, setBusy] = useState<null | "download" | "share" | "approve">(null);
  const download = async () => {
    setBusy("download");
    try {
      downloadBlob(await currentBlob(), fileName);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось создать PDF");
    } finally {
      setBusy(null);
    }
  };
  const share = async () => {
    setBusy("share");
    try {
      const r = await sharePdf(await currentBlob(), fileName);
      if (r === "downloaded") toast.info("Передача файла недоступна на этом устройстве. PDF скачан — отправьте его пациенту вручную (WhatsApp, Telegram, почта).");
      else if (r === "opened") toast.message("Открыто окно отправки. Приложение не знает, был ли файл отправлен.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось создать PDF");
    } finally {
      setBusy(null);
    }
  };

  const issues = useMemo(() => validateCard(card), [card]);
  const [reviewed, setReviewed] = useState(false);

  const approve = async () => {
    setBusy("approve");
    try {
      await autosave.flush();
      if (autosave.hasPending()) throw new Error("Не удалось сохранить изменения. Утверждение отменено.");
      const prep = await prepareApprovalAction(cardId);
      if (!prep.ok) throw new Error(prep.error);
      const local = await docHash(docCtx, cardRef.current);
      if (local !== prep.data.hash) throw new Error("Данные на сервере отличаются от открытых. Обновите страницу и повторите.");

      const out = await renderPdfBlob(await snapshotFor(docCtx, cardRef.current));
      const plan = prep.data.plan;
      if (plan.kind === "supabase") {
        const { error } = await createSupabaseBrowser().storage.from(plan.bucket).uploadToSignedUrl(plan.path, plan.token, out, { contentType: "application/pdf" });
        if (error) throw new Error("Не удалось загрузить PDF в хранилище");
      } else {
        const r = await fetch(plan.url, { method: "PUT", body: out, headers: { "content-type": "application/pdf" } });
        if (!r.ok) throw new Error("Не удалось загрузить PDF в хранилище");
      }
      const fin = await finalizeApprovalAction(cardId, {
        path: prep.data.path,
        hash: prep.data.hash,
        size: out.size,
        sha256: await sha256Hex(await out.arrayBuffer()),
        fileName: prep.data.fileName,
        reviewed: true,
      });
      if (!fin.ok) throw new Error(fin.error);
      toast.success(`Карта утверждена (версия ${fin.data.version})`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось утвердить карту");
    } finally {
      setBusy(null);
    }
  };

  /* -------------------------------------------------- section body */
  const props: SectionProps = { card, patch, pickImage, faceUrl };
  const body = (() => {
    switch (section) {
      case "cover":
        return <CoverSection {...props} />;
      case "personal":
        return (
          <PersonalSection
            {...props}
            onRefresh={async () => {
              const r = await refreshPersonalAction(patientId);
              if (!r.ok) return void toast.error(r.error);
              patch((c) => void (c.personal = r.data));
              toast.success("Данные обновлены из анамнеза");
            }}
          />
        );
      case "skin":
        return <SkinSection {...props} />;
      case "care":
        return <CareSection {...props} />;
      case "actives":
        return <ActivesSection {...props} />;
      case "nutrition":
        return <NutritionSection {...props} />;
      case "vitamins":
        return <VitaminsSection {...props} />;
      case "products":
        return <ProductsSection {...props} />;
      case "procedures":
        return <ProceduresSection {...props} />;
      case "conclusion":
        return <ConclusionSection {...props} />;
      case "extra":
        return <ExtraSection {...props} />;
      case "review":
        return (
          <ReviewPanel
            issues={issues}
            reviewed={reviewed}
            setReviewed={setReviewed}
            approving={busy === "approve"}
            onApprove={approve}
            onJump={(page) => {
              const hit = SECTIONS.find((s) => s.label === page);
              if (hit) {
                setSection(hit.key);
                setView("edit");
              }
            }}
            versions={versions}
          />
        );
    }
  })();

  // Voice-first sections: everything from «Состояние кожи» to the review (ADR-019).
  const smartVoice = section !== "cover" && section !== "personal";
  const sectionBody = (
    <SmartVoiceProvider enabled={smartVoice} terms={card.products.items.map(productLine).filter(Boolean)}>
      {smartVoice && section !== "review" && (
        <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground/80">
          Нажмите микрофон в любом поле и говорите: текст сразу появится в поле, ошибки исправятся. Можно говорить «запятая», «двоеточие», «новая строка».
        </p>
      )}
      {body}
    </SmartVoiceProvider>
  );

  const status = (
    <SaveBadge
      status={autosave.status}
      message={autosave.message}
      onRetry={autosave.retry}
      onConflict={() => window.location.reload()}
    />
  );

  const actions = (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button type="button" variant="outline" className="h-11 sm:h-8" onClick={saveDraft} title="Ctrl+S">
        <Save /> Сохранить черновик
      </Button>
      <Button type="button" variant="outline" className="h-11 sm:h-8" onClick={download} disabled={busy !== null}>
        {busy === "download" ? <Loader2 className="animate-spin" /> : <Download />} Скачать PDF
      </Button>
      <Button type="button" variant="outline" className="h-11 sm:h-8" onClick={share} disabled={busy !== null}>
        {busy === "share" ? <Loader2 className="animate-spin" /> : <Share2 />} Поделиться
      </Button>
      <Button type="button" className="h-11 sm:h-8" onClick={() => setSection("review")}>
        <FileCheck2 /> Утвердить
      </Button>
    </div>
  );

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-background px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Link href={`/patients/${patientId}?tab=cards`} className="inline-flex min-h-11 items-center text-xs text-muted-foreground hover:text-primary lg:min-h-0">
          ← {docCtx.patient.fullName}
        </Link>
      </div>
      <div className="flex items-center gap-3">
        {status}
        {desktop && actions}
      </div>
    </div>
  );

  const pickerNode = picker && picker.category === "patient" ? (
    <PatientPhotoPicker
      patientId={patientId}
      open
      onClose={() => setPicker(null)}
      onPick={(id) => {
        picker.done(id);
        setPicker(null);
      }}
    />
  ) : (
    picker && (
    <MediaPicker
      open
      category={picker.category}
      onClose={() => setPicker(null)}
      onPick={(id) => {
        picker.done(id);
        setPicker(null);
      }}
    />
    )
  );

  /* ================================================== desktop: navigation · editor · PDF */
  if (desktop) {
    return (
      <div className="flex h-dvh flex-col">
        {header}
        <div className="flex min-h-0 flex-1">
          {navOpen && (
            <nav className="w-60 shrink-0 overflow-y-auto border-r bg-surface p-2" aria-label="Разделы карты">
              {SECTIONS.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSection(s.key)}
                  aria-current={section === s.key ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-sm",
                    section === s.key ? "bg-primary/10 font-medium text-primary" : "text-foreground/80 hover:bg-secondary",
                  )}
                >
                  <span className="w-5 shrink-0 text-xs text-muted-foreground">{i < 10 ? i + 1 : ""}</span>
                  {s.label}
                </button>
              ))}
            </nav>
          )}
          <div className="min-w-0 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between gap-2 px-4 pt-3">
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setNavOpen((v) => !v)} aria-label={navOpen ? "Свернуть разделы" : "Показать разделы"} title="Ctrl+B">
                {navOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
              </Button>
              <h2 className="flex-1 truncate text-lg">{SECTIONS[idx].label}</h2>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPdfOpen((v) => !v)} aria-label={pdfOpen ? "Свернуть PDF" : "Показать PDF"} title="Ctrl+\\">
                {pdfOpen ? <PanelRightClose /> : <PanelRightOpen />}
              </Button>
            </div>
            <div className="mx-auto max-w-2xl space-y-4 p-4">{sectionBody}</div>
          </div>
          {pdfOpen && (
            <>
              <ResizeHandle onDrag={(dx) => setPdfWidth((w) => Math.min(760, Math.max(320, w - dx)))} />
              <div className="flex min-h-0 shrink-0" style={{ width: pdfWidth }}>
                <PdfViewer blob={blob} busy={pdfBusy} error={pdfError} className="w-full" />
              </div>
            </>
          )}
        </div>
        {pickerNode}
      </div>
    );
  }

  /* ================================================== phone / tablet portrait: step by step */
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col">
      {header}
      <div className="sticky top-14 z-20 grid grid-cols-3 border-b bg-background text-sm" role="tablist" aria-label="Режим">
        {(
          [
            ["sections", "Разделы"],
            ["edit", "Редактор"],
            ["pdf", "PDF"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={view === k}
            onClick={() => setView(k)}
            className={cn("min-h-11 border-b-2", view === k ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 py-4 pb-28">
        {view === "sections" && (
          <ol className="divide-y rounded-md border bg-surface">
            {SECTIONS.map((s, i) => (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => {
                    setSection(s.key);
                    setView("edit");
                  }}
                  className={cn("flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm", section === s.key && "bg-primary/5 font-medium text-primary")}
                >
                  <span className="w-5 text-xs text-muted-foreground">{i < 10 ? i + 1 : ""}</span>
                  {s.label}
                  <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ol>
        )}
        {view === "edit" && (
          <div className="space-y-4">
            <h2 className="text-lg">{SECTIONS[idx].label}</h2>
            {sectionBody}
          </div>
        )}
        {view === "pdf" && <PdfViewer blob={blob} busy={pdfBusy} error={pdfError} className="h-[calc(100dvh-14rem)] rounded-md border" />}
      </div>

      {/* Pinned action bar: stays above the on-screen keyboard (dvh/safe-area aware) and never overlaps fields. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-surface px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {view === "pdf" ? (
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-12 flex-1" onClick={download} disabled={busy !== null}>
              {busy === "download" ? <Loader2 className="animate-spin" /> : <Download />} Скачать
            </Button>
            <Button type="button" variant="outline" className="h-12 flex-1" onClick={share} disabled={busy !== null}>
              {busy === "share" ? <Loader2 className="animate-spin" /> : <Share2 />} Поделиться
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-12 w-12 shrink-0 px-0" aria-label="Назад" onClick={() => go(-1)} disabled={idx === 0}>
              <ChevronLeft />
            </Button>
            <Button type="button" variant="outline" className="h-12 flex-1" onClick={() => setView("pdf")}>
              <Eye /> Предпросмотр
            </Button>
            <Button type="button" className="h-12 flex-1" onClick={() => (idx === SECTIONS.length - 1 ? void saveDraft() : (setView("edit"), go(1)))}>
              {idx === SECTIONS.length - 1 ? "Сохранить" : "Далее"} <ChevronRight />
            </Button>
          </div>
        )}
      </div>
      {pickerNode}
    </div>
  );
}

/* ---------------------------------------------------------------- helpers */

/** Drag handle between the editor and the PDF pane. */
function ResizeHandle({ onDrag }: { onDrag: (dx: number) => void }) {
  const last = useRef<number | null>(null);
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Изменить ширину предпросмотра"
      tabIndex={0}
      onPointerDown={(e) => {
        last.current = e.clientX;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (last.current === null) return;
        onDrag(e.clientX - last.current);
        last.current = e.clientX;
      }}
      onPointerUp={() => (last.current = null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onDrag(-24);
        if (e.key === "ArrowRight") onDrag(24);
      }}
      className="w-1.5 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary/40 focus-visible:bg-primary/40"
    />
  );
}

function ReviewPanel({
  issues,
  reviewed,
  setReviewed,
  approving,
  onApprove,
  onJump,
  versions,
}: {
  issues: ReturnType<typeof validateCard>;
  reviewed: boolean;
  setReviewed: (v: boolean) => void;
  approving: boolean;
  onApprove: () => void;
  onJump: (page: string) => void;
  versions: number;
}) {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Приложение только сообщает о пропусках и возможных несоответствиях — оно ничего не исправляет и не принимает медицинских решений. Решение за вами.
      </p>
      {issues.length === 0 ? (
        <p className="rounded-md border border-green-700/30 bg-green-50 p-3 text-sm text-green-900">Замечаний нет.</p>
      ) : (
        <ul className="space-y-1.5">
          {[...errors, ...warnings].map((i) => (
            <li key={i.id} className={cn("flex gap-2 rounded-md border p-2.5 text-sm", i.severity === "error" ? "border-destructive/40 bg-destructive/5" : "border-amber-600/30 bg-amber-50 text-amber-950")}>
              <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", i.severity === "error" ? "text-destructive" : "text-amber-700")} />
              <div className="min-w-0 flex-1">
                <p>{i.message}</p>
                <button type="button" onClick={() => onJump(i.page)} className="text-xs text-primary underline underline-offset-2">
                  Перейти: {i.page}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <label className="flex items-start gap-2 rounded-md border bg-surface p-3 text-sm">
        <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} className="mt-0.5 size-5 accent-primary" />
        <span>Я лично проверил(а) все рекомендации, препараты, дозировки и единицы измерения и утверждаю этот документ для пациента.</span>
      </label>
      <Button type="button" className="h-12 w-full sm:h-9 sm:w-auto" disabled={!reviewed || errors.length > 0 || approving} onClick={onApprove}>
        {approving ? <Loader2 className="animate-spin" /> : <FileCheck2 />}
        Утвердить карту{versions > 0 ? ` (версия ${versions + 1})` : ""}
      </Button>
      {errors.length > 0 && <p className="text-xs text-destructive">Исправьте ошибки, чтобы утвердить карту.</p>}
    </div>
  );
}
