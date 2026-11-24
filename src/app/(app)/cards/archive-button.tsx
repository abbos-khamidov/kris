"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { archiveCardAction } from "./actions";

/** Archiving only hides the card from working lists; its approved versions and PDFs are never touched. */
export function CardArchiveButton({ cardId, archived }: { cardId: string; archived: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-11 shrink-0 sm:size-8"
      disabled={pending}
      aria-label={archived ? "Вернуть из архива" : "В архив"}
      title={archived ? "Вернуть из архива" : "В архив"}
      onClick={() =>
        start(async () => {
          const res = await archiveCardAction(cardId, !archived);
          if (!res.ok) return void toast.error(res.error);
          toast.success(archived ? "Карта возвращена из архива" : "Карта перенесена в архив");
          router.refresh();
        })
      }
    >
      {archived ? <ArchiveRestore /> : <Archive />}
    </Button>
  );
}
