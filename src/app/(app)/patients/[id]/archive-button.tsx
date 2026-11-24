"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setPatientArchivedAction } from "../actions";

export function ArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      className="h-11 sm:h-8"
      onClick={() =>
        start(async () => {
          const res = await setPatientArchivedAction(id, !archived);
          if (!res.ok) return void toast.error(res.error);
          toast.success(archived ? "Пациент возвращён из архива" : "Пациент перенесён в архив");
          router.refresh();
        })
      }
    >
      {archived ? <ArchiveRestore /> : <Archive />}
      {archived ? "Вернуть из архива" : "В архив"}
    </Button>
  );
}
