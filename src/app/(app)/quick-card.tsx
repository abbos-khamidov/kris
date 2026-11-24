"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createCardAction } from "./cards/actions";

export function QuickCard({ patients }: { patients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [id, setId] = useState("");
  const [pending, start] = useTransition();
  if (patients.length === 0) {
    return <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Сначала создайте пациента.</p>;
  }
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <select
        aria-label="Пациент"
        value={id}
        onChange={(e) => setId(e.target.value)}
        className="h-11 min-w-0 flex-1 rounded-md border border-input bg-surface px-3 text-sm sm:h-8"
      >
        <option value="">Выберите пациента…</option>
        {patients.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <Button
        type="button"
        className="h-11 sm:h-8"
        disabled={!id || pending}
        onClick={() =>
          start(async () => {
            const res = await createCardAction(id);
            if (!res.ok) return void toast.error(res.error);
            router.push(`/cards/${res.data.id}`);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <FilePlus2 />} Создать карту
      </Button>
    </div>
  );
}
