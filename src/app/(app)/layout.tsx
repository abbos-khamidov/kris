import { AppShell } from "@/components/app-shell";
import { backendMode, getCtx } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCtx();
  return (
    <AppShell email={ctx.user.email} demo={backendMode() === "local"}>
      {children}
    </AppShell>
  );
}
