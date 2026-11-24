"use client";
import { Input } from "@/components/ui/input";
import { PRICE_KINDS, PRICE_KIND_LABEL, type Price } from "@/lib/schemas/common";
import { formatPrice } from "@/lib/format";

const num = (v: string): number | null => {
  const n = Number(v.replace(/[\s ]/g, "").replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) || n < 0 ? null : n;
};

/**
 * One price control for products and procedures: fixed, range, from, approximate, on request or
 * free text (e.g. "3500 ₽ / аптека"). Shows the exact text that will appear in the PDF.
 */
export function PriceEditor({ value, onChange, label }: { value: Price; onChange: (p: Price) => void; label: string }) {
  const kind = value.kind;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        <select
          aria-label={`${label}: формат цены`}
          value={kind}
          onChange={(e) => onChange({ ...value, kind: e.target.value as Price["kind"] })}
          className="h-11 rounded-md border border-input bg-surface px-2 text-sm sm:h-8"
        >
          {PRICE_KINDS.map((k) => (
            <option key={k} value={k}>
              {PRICE_KIND_LABEL[k]}
            </option>
          ))}
        </select>
        {kind !== "request" && kind !== "text" && (
          <Input
            inputMode="decimal"
            aria-label={`${label}: сумма${kind === "range" ? " от" : ""}`}
            placeholder={kind === "range" ? "от, ₽" : "₽"}
            value={value.amount ?? ""}
            onChange={(e) => onChange({ ...value, amount: num(e.target.value) })}
            className="h-11 w-28 sm:h-8"
          />
        )}
        {kind === "range" && (
          <Input
            inputMode="decimal"
            aria-label={`${label}: сумма до`}
            placeholder="до, ₽"
            value={value.max ?? ""}
            onChange={(e) => onChange({ ...value, max: num(e.target.value) })}
            className="h-11 w-28 sm:h-8"
          />
        )}
        {kind === "text" && (
          <Input
            aria-label={`${label}: текст цены`}
            placeholder="Например: 3500 ₽ / аптека"
            maxLength={80}
            value={value.text}
            onChange={(e) => onChange({ ...value, text: e.target.value })}
            className="h-11 min-w-48 flex-1 sm:h-8"
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        В PDF: <span className="font-medium text-foreground">{formatPrice(value) || "—"}</span>
      </p>
    </div>
  );
}
