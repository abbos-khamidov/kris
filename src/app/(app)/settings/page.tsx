import { getCtx } from "@/lib/db";
import { BRAND_INFO } from "@/lib/brand";
import { BRAND_ROLES } from "@/lib/schemas/card";
import { getSettings } from "@/lib/services/settings";
import { BrandImages } from "./brand-images";
import { PasswordForm } from "./password-form";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Настройки" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await getCtx();
  const settings = await getSettings(ctx);
  const items = await Promise.all(
    BRAND_ROLES.map(async (role) => {
      const assetId = settings.brandImages[role] ?? null;
      let url: string | null = null;
      if (assetId) {
        const a = await ctx.db.get<{ path: string }>("media_assets", assetId);
        if (a) url = await ctx.storage.signedUrl(a.path, 900);
      }
      return { role, assetId, url, ...BRAND_INFO[role] };
    }),
  );

  return (
    <div className="animate-fade-in mx-auto max-w-3xl space-y-8">
      <h1 className="text-2xl">Настройки</h1>
      <SettingsForm initial={settings} />
      <PasswordForm />
      <section className="space-y-3">
        <div>
          <h2 className="text-lg">Фирменные изображения</h2>
          <p className="text-sm text-muted-foreground">
            Постоянные элементы оформления: подставляются во все новые карты автоматически. Замена не меняет уже утверждённые PDF.
          </p>
        </div>
        <BrandImages items={items} />
      </section>
    </div>
  );
}
