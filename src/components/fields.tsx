"use client";
import { useId } from "react";
import { Label } from "@/components/ui/label";
import { TRI_LABEL, TRI_VALUES, type Tri } from "@/lib/schemas/common";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  /** id of the single control this label names; omit for groups of controls. */
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className={cn("space-y-1.5", className)}>
      <Label id={labelId} htmlFor={htmlFor} className="text-[13px] font-medium">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Compact single-choice control with 44px touch targets on small screens. */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex flex-wrap gap-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-11 rounded-md border px-3 text-sm transition-colors sm:min-h-9",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-surface text-foreground/80 hover:border-primary/50",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Yes / No / Unknown / Not specified — nothing is ever pre-selected as "No". */
export function TriField({ value, onChange, label }: { value: Tri; onChange: (v: Tri) => void; label: string }) {
  return (
    <Segmented
      value={value}
      onChange={onChange}
      label={label}
      options={TRI_VALUES.map((v) => ({ value: v, label: TRI_LABEL[v] }))}
    />
  );
}
