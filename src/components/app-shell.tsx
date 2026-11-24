"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  FileText,
  FolderInput,
  Images,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Menu,
  Package,
  Settings,
  Users,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/login/actions";
import { SunGift } from "@/components/sun-gift";

const NAV = [
  { href: "/", label: "Дашборд", icon: LayoutDashboard },
  { href: "/patients", label: "Пациенты", icon: Users },
  { href: "/cards", label: "Карты", icon: FileText },
  { href: "/catalog", label: "Каталог средств", icon: Package },
  { href: "/templates", label: "Шаблоны", icon: LayoutTemplate },
  { href: "/media", label: "Медиатека", icon: Images },
  { href: "/import", label: "Импорт карт", icon: FolderInput },
  { href: "/settings", label: "Настройки", icon: Settings },
] as const;

const MOBILE_MAIN = ["/", "/patients", "/cards"];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          aria-current={isActive(pathname, href) ? "page" : undefined}
          className={cn(
            "group relative flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-all duration-200 active:scale-[0.98] lg:min-h-0",
            isActive(pathname, href)
              ? "bg-primary/10 font-semibold text-primary shadow-[inset_0_0_0_1px] shadow-primary/15"
              : "text-muted-foreground hover:translate-x-0.5 hover:bg-secondary hover:text-foreground",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-y-1.5 left-0 w-[3px] origin-center rounded-full bg-primary transition-transform duration-300",
              isActive(pathname, href) ? "scale-y-100" : "scale-y-0",
            )}
          />
          <Icon className={cn("size-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110", isActive(pathname, href) && "text-primary")} />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function Logout() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-foreground"
      >
        <LogOut className="size-4" />
        Выйти
      </button>
    </form>
  );
}

export function AppShell({ children, email, demo }: { children: React.ReactNode; email: string; demo: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // The card editor is a full-bleed workspace with its own step bar instead of the bottom navigation.
  const bleed = pathname.startsWith("/cards/") && pathname.split("/").length === 3;
  const mobileItems = NAV.filter((n) => MOBILE_MAIN.includes(n.href));
  const moreActive = !MOBILE_MAIN.some((h) => isActive(pathname, h));

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-sidebar p-4 lg:flex">
        <Link href="/" className="mb-6 px-3 pt-2 font-serif text-xl tracking-[0.16em] text-primary">
          KRIS SKIN
        </Link>
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <div className="mt-4 border-t pt-3">
          <p className="truncate px-3 pb-2 text-xs text-muted-foreground" title={email}>
            {email}
          </p>
          {demo && <p className="px-3 pb-2 text-[11px] text-accent-foreground/70">Демо-режим · локальные данные</p>}
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1">
              <Logout />
            </div>
            <SunGift />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background px-4 py-3 lg:hidden">
          <Link href="/" className="flex min-h-11 items-center font-serif text-lg tracking-[0.16em] text-primary">
            KRIS SKIN
          </Link>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              aria-label="Открыть меню"
              className="grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-sidebar p-4">
              <SheetHeader className="p-0 pb-4">
                <SheetTitle className="font-serif tracking-[0.16em] text-primary">KRIS SKIN</SheetTitle>
              </SheetHeader>
              <NavLinks onNavigate={() => setOpen(false)} />
              <div className="mt-4 border-t pt-3">
                <p className="truncate px-3 pb-2 text-xs text-muted-foreground">{email}</p>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <Logout />
                  </div>
                  <SunGift />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <main className={bleed ? "w-full flex-1" : "mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 lg:px-8 lg:py-8 lg:pb-8"}>{children}</main>

        <nav
          className={cn("fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden", bleed && "hidden")}
          aria-label="Основная навигация"
        >
          {mobileItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-col items-center gap-0.5 py-2 text-[11px] transition-colors active:bg-secondary",
                isActive(pathname, href) ? "font-semibold text-primary" : "text-muted-foreground",
              )}
            >
              <span aria-hidden="true" className={cn("absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-primary transition-transform duration-300", isActive(pathname, href) ? "scale-x-100" : "scale-x-0")} />
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", moreActive ? "text-primary" : "text-muted-foreground")}
          >
            <Menu className="size-5" />
            Ещё
          </button>
        </nav>
      </div>
    </div>
  );
}
