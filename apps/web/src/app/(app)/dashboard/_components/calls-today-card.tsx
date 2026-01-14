import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CallItem {
  id: string;
  time: string;
  contactName: string;
  propertyAddress: string;
}

interface CallsTodayCardProps {
  calls: CallItem[];
}

export function CallsTodayCard({ calls }: CallsTodayCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Calls Today</CardTitle>
          <span className="text-2xl font-bold">{calls.length}</span>
        </div>
      </CardHeader>
      <CardContent>
        {calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
            <Phone className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No calls scheduled</p>
          </div>
        ) : (
          <ScrollArea className="h-[120px]">
            <div className="space-y-2">
              {calls.map((call) => (
                <div
                  key={call.id}
                  className="flex items-start gap-3 text-sm p-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
                >
                  <span className="font-mono text-muted-foreground whitespace-nowrap">
                    {call.time}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{call.contactName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {call.propertyAddress}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
