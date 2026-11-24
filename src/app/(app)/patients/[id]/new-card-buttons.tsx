"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, FilePlus2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createCardAction } from "../../cards/actions";

/** One tap: a fresh card (brand design + patient data prefilled) or a copy of an earlier card. */
export function NewCardButtons({ patientId, previousCardId }: { patientId: string; previousCardId: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const create = (basedOn?: string) =>
    start(async () => {
      const res = await createCardAction(patientId, basedOn);
      if (!res.ok) return void toast.error(res.error);
      router.push(`/cards/${res.data.id}`);
    });
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" className="h-11 sm:h-8" disabled={pending} onClick={() => create()}>
        {pending ? <Loader2 className="animate-spin" /> : <FilePlus2 />} Новая карта
      </Button>
      {previousCardId && (
        <Button type="button" variant="outline" className="h-11 sm:h-8" disabled={pending} onClick={() => create(previousCardId)}>
          <Copy /> На основе предыдущей
        </Button>
      )}
    </div>
  );
}
