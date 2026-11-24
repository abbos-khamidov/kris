"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageCropDialog } from "@/components/image-crop-dialog";
import { ImageDropzone } from "@/components/image-dropzone";
import { Field, Segmented } from "@/components/fields";
import { formatDateRu } from "@/lib/format";
import { optimizeFile, type ProcessedImage } from "@/lib/media/process";
import { uploadProcessed } from "@/lib/media/upload";
import { ANGLES, ANGLE_LABEL, STAGES, STAGE_LABEL } from "@/lib/photos";
import { cn } from "@/lib/utils";
import { addPatientPhotoAction, deletePatientPhotoAction, listPatientPhotosAction, updatePatientPhotoAction, type PatientPhoto } from "./photos-actions";

/** Optional gallery. Photos are private; nothing reaches a PDF unless "Разрешить в PDF" is ticked. */
export function PhotosTab({ patientId, consultations }: { patientId: string; consultations: { id: string; date: string }[] }) {
  const [photos, setPhotos] = useState<PatientPhoto[] | null>(null);
  const [stage, setStage] = useState<(typeof STAGES)[number]>("before");
  const [angle, setAngle] = useState<(typeof ANGLES)[number]>("front");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [consultationId, setConsultationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [crop, setCrop] = useState<File | null>(null);
  const [cmp, setCmp] = useState<{ a: string; b: string }>({ a: "", b: "" });

  const load = useCallback(async () => {
    const r = await listPatientPhotosAction(patientId);
    if (r.ok) setPhotos(r.data);
    else toast.error(r.error);
  }, [patientId]);
  useEffect(() => void load(), [load]);

  const attach = async (img: ProcessedImage, name: string) => {
    const asset = await uploadProcessed(img, { category: "patient", name });
    const r = await addPatientPhotoAction(patientId, asset.id, { takenAt: date, stage, angle, comment: "", allowInPdf: false, consultationId: consultationId || null });
    if (!r.ok) throw new Error(r.error);
  };

  const onFiles = async (files: File[]) => {
    if (files.length === 1) return void setCrop(files[0]); // single photo: offer crop / rotate
    setBusy(true);
    try {
      for (const f of files) await attach(await optimizeFile(f), f.name);
      toast.success(`Загружено фото: ${files.length}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить");
    } finally {
      setBusy(false);
      void load();
    }
  };

  const byDate = useMemo(() => (photos ?? []).slice().sort((x, y) => x.takenAt.localeCompare(y.takenAt)), [photos]);
  const A = byDate.find((p) => p.id === cmp.a);
  const B = byDate.find((p) => p.id === cmp.b);

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-md border bg-surface p-4">
        <h2 className="text-lg">Добавить фото</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Дата съёмки" htmlFor="ph-date">
            <Input id="ph-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 sm:h-8" />
          </Field>
          <Field label="Консультация" htmlFor="ph-cons">
            <select id="ph-cons" value={consultationId} onChange={(e) => setConsultationId(e.target.value)} className="h-11 w-full rounded-md border border-input bg-surface px-2 text-sm sm:h-8">
              <option value="">Не привязано</option>
              {consultations.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatDateRu(c.date)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Категория">
          <Segmented label="Категория" value={stage} onChange={setStage} options={STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))} />
        </Field>
        <Field label="Ракурс">
          <Segmented label="Ракурс" value={angle} onChange={setAngle} options={ANGLES.map((s) => ({ value: s, label: ANGLE_LABEL[s] }))} />
        </Field>
        <ImageDropzone multiple onFiles={onFiles} disabled={busy} label="Перетащите фото сюда или выберите. Фильтры и ретушь не применяются." />
        {busy && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Загрузка…
          </p>
        )}
      </section>

      {photos && photos.length >= 2 && (
        <section className="space-y-3 rounded-md border bg-surface p-4">
          <h2 className="text-lg">Сравнение до / после</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["a", "b"] as const).map((k) => (
              <select key={k} aria-label={k === "a" ? "Левое фото" : "Правое фото"} value={cmp[k]} onChange={(e) => setCmp({ ...cmp, [k]: e.target.value })} className="h-11 rounded-md border border-input bg-surface px-2 text-sm sm:h-8">
                <option value="">{k === "a" ? "Выберите левое фото…" : "Выберите правое фото…"}</option>
                {byDate.map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatDateRu(p.takenAt)} · {STAGE_LABEL[p.stage]} · {ANGLE_LABEL[p.angle]}
                  </option>
                ))}
              </select>
            ))}
          </div>
          {(A || B) && (
            <div className="grid grid-cols-2 gap-2">
              {[A, B].map((p, i) => (
                <figure key={i} className="overflow-hidden rounded-md border bg-secondary">
                  {p ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={`${STAGE_LABEL[p.stage]}, ${formatDateRu(p.takenAt)}`} className="aspect-[3/4] w-full object-cover" />
                      <figcaption className="p-2 text-xs text-muted-foreground">
                        {formatDateRu(p.takenAt)} · {STAGE_LABEL[p.stage]}
                      </figcaption>
                    </>
                  ) : (
                    <div className="grid aspect-[3/4] place-items-center text-xs text-muted-foreground">Не выбрано</div>
                  )}
                </figure>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg">Галерея</h2>
        {photos === null ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : photos.length === 0 ? (
          <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">Фотографий пока нет. Галерея необязательна.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {byDate.map((p) => (
              <li key={p.id} className="space-y-2 rounded-md border bg-surface p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`${STAGE_LABEL[p.stage]}, ${formatDateRu(p.takenAt)}`} className="aspect-[3/4] w-full rounded object-cover" loading="lazy" />
                <p className="text-xs text-muted-foreground">
                  {formatDateRu(p.takenAt)} · {STAGE_LABEL[p.stage]} · {ANGLE_LABEL[p.angle]}
                </p>
                <Input
                  defaultValue={p.comment}
                  placeholder="Комментарий специалиста"
                  aria-label="Комментарий к фото"
                  className="h-11 sm:h-8"
                  onBlur={async (e) => {
                    if (e.target.value !== p.comment) await updatePatientPhotoAction(p.id, patientId, { comment: e.target.value });
                  }}
                />
                <div className="flex items-center justify-between gap-2">
                  <label className={cn("flex min-h-11 items-center gap-2 text-sm sm:min-h-8", p.allowInPdf && "text-primary")}>
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={p.allowInPdf}
                      onChange={async (e) => {
                        await updatePatientPhotoAction(p.id, patientId, { allowInPdf: e.target.checked });
                        void load();
                      }}
                    />
                    Разрешить в PDF
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 sm:size-8"
                    aria-label="Удалить фото"
                    onClick={async () => {
                      const r = await deletePatientPhotoAction(p.id, patientId);
                      if (!r.ok) toast.error(r.error);
                      void load();
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ImageCropDialog
        file={crop}
        title="Фото: кадрирование и поворот"
        onCancel={() => setCrop(null)}
        onDone={async (img) => {
          if (!crop) return;
          try {
            await attach(img, crop.name);
            toast.success("Фото добавлено");
            setCrop(null);
            void load();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Не удалось загрузить");
          }
        }}
      />
    </div>
  );
}
