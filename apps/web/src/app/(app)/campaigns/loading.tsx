import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function CampaignsLoading() {
  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="space-y-2">
          <Skeleton className="h-7 sm:h-8 w-32 sm:w-36" />
          <Skeleton className="h-4 w-48 sm:w-64" />
        </div>
        <Skeleton className="h-10 w-full sm:w-36" />
      </div>

      {/* Tabs */}
      <div className="space-y-4">
        <Skeleton className="h-10 w-full sm:w-[500px]" />

        {/* Campaign Cards */}
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-40 sm:w-48" />
                    <Skeleton className="h-4 w-32 sm:w-40" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16 sm:w-20" />
                    <Skeleton className="h-8 w-20 sm:w-24" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {/* Metrics Row */}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <div key={j} className={`p-2 sm:p-3 bg-muted/50 rounded-lg ${j > 3 ? "hidden sm:block" : ""}`}>
                      <Skeleton className="h-3 w-12 mb-1" />
                      <Skeleton className="h-5 w-8" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
