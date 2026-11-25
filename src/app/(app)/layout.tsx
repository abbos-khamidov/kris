import { AppShell } from "@/components/app-shell";
import { ThemeProvider } from "@/components/theme-provider";
import { backendMode, getCtx } from "@/lib/db";
import { getUiPrefs } from "@/lib/services/settings";
import { DEFAULT_PREFS, PALETTES, type ThemePrefs } from "@/lib/theme";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCtx();
  const t = (await getUiPrefs(ctx)).theme as Partial<ThemePrefs> | undefined;
  const valid = t && (t.palette === "custom" || (t.palette && t.palette in PALETTES)) && ["light", "dark", "system"].includes(t.mode ?? "") && /^#[0-9a-fA-F]{6}$/.test(t.custom ?? "");
  return (
    <ThemeProvider initial={valid ? (t as ThemePrefs) : DEFAULT_PREFS}>
      <AppShell email={ctx.user.email} demo={backendMode() === "local"}>
        {children}
      </AppShell>
    </ThemeProvider>
  );
}
