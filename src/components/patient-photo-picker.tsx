"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listPatientPhotosAction, type PatientPhoto } from "@/app/(app)/patients/[id]/photos-actions";
import { ANGLE_LABEL, STAGE_LABEL } from "@/lib/photos";
import { formatDateRu } from "@/lib/format";

/** Only photos the specialist explicitly allowed for PDFs are offered; everything else stays private. */
export function PatientPhotoPicker({ patientId, open, onClose, onPick }: { patientId: string; open: boolean; onClose: () => void; onPick: (assetId: string) => void }) {
  const [photos, setPhotos] = useState<PatientPhoto[] | null>(null);
  useEffect(() => {
    if (!open) return void setPhotos(null);
    void listPatientPhotosAction(patientId).then((r) => setPhotos(r.ok ? r.data.filter((p) => p.allowInPdf) : []));
  }, [open, patientId]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Фото пациента</DialogTitle>
          <DialogDescription>Здесь только фото с отметкой «Разрешить в PDF» (вкладка «Фотографии» в профиле).</DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] overflow-y-auto">
          {photos === null ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Загрузка…</p>
          ) : photos.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Нет фотографий, разрешённых для PDF. Отметьте их в профиле пациента.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(p.assetId);
                      onClose();
                    }}
                    className="block w-full overflow-hidden rounded-md border text-left hover:border-primary"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={STAGE_LABEL[p.stage]} className="aspect-[3/4] w-full object-cover" loading="lazy" />
                    <span className="block p-2 text-xs text-muted-foreground">
                      {formatDateRu(p.takenAt)} · {STAGE_LABEL[p.stage]} · {ANGLE_LABEL[p.angle]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
