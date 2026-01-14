import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StalledDeal {
  id: string;
  companyName: string;
  daysSinceResponse: number;
  status: string;
}

interface StalledDealsCardProps {
  deals: StalledDeal[];
}

export function StalledDealsCard({ deals }: StalledDealsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Stalled Deals</CardTitle>
          <span className="text-2xl font-bold text-amber-500">{deals.length}</span>
        </div>
      </CardHeader>
      <CardContent>
        {deals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
            <div className="flex items-center gap-2 text-green-500">
              <span className="text-lg">Pipeline flowing</span>
            </div>
            <p className="text-sm">No stalled deals</p>
          </div>
        ) : (
          <ScrollArea className="h-[120px]">
            <div className="space-y-3">
              {deals.map((deal) => (
                <div
                  key={deal.id}
                  className="p-2 rounded-md border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{deal.companyName}</span>
                    <span className="text-xs text-amber-500">
                      {deal.daysSinceResponse} days
                    </span>
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Status: {deal.status}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
