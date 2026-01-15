"use client";

import {
  Mail,
  MailOpen,
  Phone,
  PhoneCall,
  FileText,
  ArrowRight,
  MessageSquare,
  Send,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/deals/utils";
import { ACTIVITY_COLORS } from "@/lib/deals/constants";
import { cn } from "@/lib/utils";
import type { DealActivity, DealActivityType } from "@/lib/deals/schema";

interface ActivityTimelineProps {
  activities: DealActivity[];
}

const ACTIVITY_ICONS: Record<DealActivityType, React.ElementType> = {
  email_sent: Mail,
  email_received: MailOpen,
  call_scheduled: Phone,
  call_completed: PhoneCall,
  doc_received: FileText,
  status_change: ArrowRight,
  note_added: MessageSquare,
  handed_off: Send,
};

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No activity yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => {
            const Icon = ACTIVITY_ICONS[activity.activity_type] ?? MessageSquare;
            const colorClass = ACTIVITY_COLORS[activity.activity_type] ?? "text-gray-500 bg-gray-100";

            return (
              <div key={activity.id} className="flex gap-3">
                <div
                  className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                    colorClass
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm">{activity.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatRelativeTime(activity.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
