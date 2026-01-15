import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function CampaignDetailLoading() {
  return (
    <div className="p-4 sm:p-6 max-w-6xl">
      {/* Back link */}
      <Skeleton className="h-4 w-24 sm:w-32 mb-4" />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4 sm:mb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-7 sm:h-8 w-48 sm:w-64" />
            <Skeleton className="h-6 w-16" />
          </div>
          <Skeleton className="h-4 w-40 sm:w-48" />
        </div>
        <Skeleton className="h-9 w-28 sm:w-32" />
      </div>

      {/* Tabs */}
      <div className="space-y-4 sm:space-y-6">
        <Skeleton className="h-10 w-full sm:w-[450px]" />

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className={i > 4 ? "col-span-2 sm:col-span-1" : ""}>
              <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
                <Skeleton className="h-3 sm:h-4 w-16 sm:w-20" />
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <Skeleton className="h-6 sm:h-8 w-16 sm:w-20" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Email Preview Cards */}
        <div className="space-y-4">
          <Skeleton className="h-5 w-32" />
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-16" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <Skeleton className="h-3 w-12 mb-1" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                    <div>
                      <Skeleton className="h-3 w-10 mb-1" />
                      <Skeleton className="h-24 w-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
