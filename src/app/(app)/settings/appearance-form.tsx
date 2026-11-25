"use client";
import { Check, Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/fields";
import { useAppTheme } from "@/components/theme-provider";
import { PALETTES, isHex, type PaletteId, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

const MODES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Светлая", icon: Sun },
  { value: "dark", label: "Тёмная", icon: Moon },
  { value: "system", label: "Системная", icon: Monitor },
];

/** Changes apply instantly (the page you are looking at is the preview) and sync across your devices. Never affects the PDF. */
export function AppearanceForm() {
  const { prefs, built, update, reset } = useAppTheme();
  const swatch = (id: PaletteId, hex: string, label: string) => (
    <button
      key={id}
      type="button"
      role="radio"
      aria-checked={prefs.palette === id}
      onClick={() => update({ palette: id })}
      className={cn(
        "flex min-h-11 items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition-all duration-200 active:scale-[0.98]",
        prefs.palette === id ? "border-primary bg-primary/5 font-medium shadow-sm" : "border-input bg-surface hover:border-primary/50",
      )}
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-full ring-1 ring-black/10" style={{ background: hex }}>
        {prefs.palette === id && <Check className="size-3.5 text-white" />}
      </span>
      {label}
    </button>
  );

  return (
    <section className="space-y-5 rounded-md border bg-surface p-5">
      <div>
        <h2 className="text-lg">Внешний вид</h2>
        <p className="text-sm text-muted-foreground">Цвет интерфейса и тема. Оформление PDF от этого не зависит и всегда остаётся фирменным.</p>
      </div>

      <Field label="Цветовая схема">
        <div role="radiogroup" aria-label="Цветовая схема" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.entries(PALETTES) as [keyof typeof PALETTES, (typeof PALETTES)[keyof typeof PALETTES]][]).map(([id, p]) => swatch(id, p.hex, p.label))}
          {swatch("custom", isHex(prefs.custom) ? prefs.custom : "#791F2B", "Свой цвет")}
        </div>
      </Field>

      {prefs.palette === "custom" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Выбор цвета" htmlFor="ap-picker">
            <input
              id="ap-picker"
              type="color"
              value={isHex(prefs.custom) ? prefs.custom : "#791F2B"}
              onChange={(e) => update({ custom: e.target.value.toUpperCase() })}
              className="h-11 w-full cursor-pointer rounded-md border border-input bg-surface p-1 sm:h-8"
            />
          </Field>
          <Field label="HEX" htmlFor="ap-hex" hint={!isHex(prefs.custom) ? "Формат #RRGGBB" : undefined}>
            <Input
              id="ap-hex"
              value={prefs.custom}
              maxLength={7}
              spellCheck={false}
              onChange={(e) => update({ custom: e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}` })}
              className="h-11 font-mono sm:h-8"
            />
          </Field>
        </div>
      )}

      {built.adjusted && (
        <p className="text-xs text-muted-foreground">
          Для читаемости (контраст WCAG AA) оттенок интерфейса подобран автоматически: светлая тема — {built.effective.light}, тёмная — {built.effective.dark}.
        </p>
      )}

      <Field label="Тема">
        <div role="radiogroup" aria-label="Тема" className="inline-flex flex-wrap gap-1">
          {MODES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={prefs.mode === value}
              onClick={() => update({ mode: value })}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm transition-all duration-200 active:scale-[0.98] sm:min-h-9",
                prefs.mode === value ? "border-primary bg-primary text-primary-foreground" : "border-input bg-surface hover:border-primary/50",
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </Field>

      <div className="rounded-md border bg-background p-4" aria-label="Предпросмотр цветовой схемы">
        <p className="mb-3 text-xs text-muted-foreground">Предпросмотр</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" className="h-11 sm:h-8">Основная кнопка</Button>
          <Button type="button" variant="outline" className="h-11 sm:h-8">Вторичная</Button>
          <span className="rounded-md bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">Активный пункт</span>
          <span className="flex items-center gap-2 text-sm">
            <span className="relative h-5 w-9 rounded-full bg-primary">
              <span className="absolute right-0.5 top-0.5 size-4 rounded-full bg-primary-foreground" />
            </span>
            Переключатель
          </span>
          <input aria-label="Пример поля" placeholder="Поле в фокусе" className="h-11 rounded-md border border-ring bg-surface px-3 text-sm ring-3 ring-ring/40 outline-none sm:h-8" readOnly />
        </div>
      </div>

      <Button type="button" variant="outline" className="h-11 sm:h-8" onClick={reset}>
        <RotateCcw /> Сбросить оформление
      </Button>
    </section>
  );
}
