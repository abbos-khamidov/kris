import { getCtx } from "@/lib/db";
import { getSettings } from "@/lib/services/settings";
import { listAssetsAction } from "./actions";
import { MediaLibrary } from "./media-library";

export const metadata = { title: "Медиатека" };
export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const ctx = await getCtx();
  const settings = await getSettings(ctx);
  const res = await listAssetsAction();
  // Patient photos live only in the patient profile (private); the library shows shared material.
  const items = (res.ok ? res.data : []).filter((a) => a.category !== "patient");
  const inUse = Object.fromEntries(Object.entries(settings.brandImages).map(([role, id]) => [id as string, role]));
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl">Медиатека</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Фирменные фотографии, изображения средств и иллюстрации. Замена фирменных слотов — в «Настройки → Фирменные изображения». Фото пациентов хранятся только в их профилях.
        </p>
      </div>
      <MediaLibrary items={items} inUse={inUse} />
    </div>
  );
}
