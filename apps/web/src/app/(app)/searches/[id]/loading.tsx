import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function SearchDetailLoading() {
  return (
    <div className="p-4 sm:p-6 max-w-6xl">
      {/* Back link */}
      <Skeleton className="h-4 w-16 sm:w-32 mb-4" />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4 sm:mb-6">
        <div className="space-y-2">
          <Skeleton className="h-7 sm:h-8 w-48 sm:w-64" />
          <Skeleton className="h-4 w-32 sm:w-40" />
        </div>
        <Skeleton className="h-7 sm:h-8 w-28 sm:w-36" />
      </div>

      {/* Tabs */}
      <div className="space-y-4 sm:space-y-6">
        <Skeleton className="h-10 w-full sm:w-96" />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
                <Skeleton className="h-3 sm:h-4 w-16 sm:w-20" />
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <Skeleton className="h-6 sm:h-8 w-12 sm:w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Content Card */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 sm:h-6 w-28 sm:w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-14 sm:w-16" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 sm:h-7 w-20 sm:w-24" />
                <Skeleton className="h-6 sm:h-7 w-24 sm:w-28" />
                <Skeleton className="h-6 sm:h-7 w-16 sm:w-20" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20 sm:w-24" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 sm:h-7 w-16 sm:w-20" />
                <Skeleton className="h-6 sm:h-7 w-20 sm:w-24" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
