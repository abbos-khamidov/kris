import { Skeleton } from "@/components/ui/skeleton";

/** Shown instantly while a page loads its data: keeps the layout stable and removes the "blank screen" feeling. */
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Загрузка">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2 bg-surface p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
