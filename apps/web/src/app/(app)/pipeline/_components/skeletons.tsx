import { Skeleton } from "@/components/ui/skeleton";
import { COLUMNS } from "@/lib/deals/constants";

export function KanbanSkeleton() {
  return (
    <div className="flex gap-4 h-full overflow-x-auto pb-4">
      {COLUMNS.map((col) => (
        <div
          key={col.id}
          className="flex-shrink-0 w-72 flex flex-col rounded-lg bg-muted/40 h-full"
        >
          <div className="flex items-center gap-2 p-3 border-b">
            <Skeleton className="w-2.5 h-2.5 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="ml-auto h-5 w-8 rounded-full" />
          </div>
          <div className="p-2 space-y-2">
            {[...Array(col.id === "qualifying" ? 3 : 1)].map((_, i) => (
              <DealCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DealCardSkeleton() {
  return (
    <div className="bg-card border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-3 w-24" />
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="h-1 flex-1" />
        <Skeleton className="h-3 w-8" />
      </div>
    </div>
  );
}

export function DealDetailSkeleton() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Skeleton className="h-4 w-32" />
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <CardSkeleton rows={6} />
          <CardSkeleton rows={3} />
          <CardSkeleton rows={4} />
        </div>
        <div className="space-y-6">
          <CardSkeleton rows={2} />
          <CardSkeleton rows={5} />
        </div>
      </div>
    </div>
  );
}

function CardSkeleton({ rows }: { rows: number }) {
  return (
    <div className="border rounded-lg p-4 space-y-4">
      <Skeleton className="h-5 w-32" />
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="space-y-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}
