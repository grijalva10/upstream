import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function SearchesLoading() {
  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="space-y-2">
          <Skeleton className="h-7 sm:h-8 w-28 sm:w-32" />
          <Skeleton className="h-4 w-56 sm:w-64" />
        </div>
        <Skeleton className="h-10 w-full sm:w-32" />
      </div>

      {/* Tabs */}
      <div className="space-y-4">
        <Skeleton className="h-10 w-full sm:w-96" />

        {/* Cards */}
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-40 sm:w-48" />
                    <Skeleton className="h-4 w-56 sm:w-72" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-14 sm:w-16" />
                    <Skeleton className="h-6 w-20 sm:w-24" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-3 sm:gap-4">
                    <Skeleton className="h-4 w-10 sm:w-12" />
                    <Skeleton className="h-4 w-10 sm:w-12" />
                    <Skeleton className="h-4 w-10 sm:w-12" />
                    <Skeleton className="h-4 w-16 sm:w-20" />
                  </div>
                  <Skeleton className="h-8 w-full sm:w-28" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
