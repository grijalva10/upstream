import { Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ActivityTabProps {
  campaignId: string;
}

export function ActivityTab({ campaignId }: ActivityTabProps) {
  // Activity timeline would require a separate activity table or events
  // For now, show placeholder
  return (
    <Card>
      <CardContent className="py-8 sm:py-12">
        <div className="flex flex-col items-center justify-center text-center">
          <Activity className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/50 mb-4" aria-hidden="true" />
          <p className="text-sm sm:text-base text-muted-foreground mb-2">
            Activity Timeline Coming Soon
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md">
            This tab will show a timeline of email sends, opens, clicks, and replies.
            Activity tracking will be available in a future update.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
