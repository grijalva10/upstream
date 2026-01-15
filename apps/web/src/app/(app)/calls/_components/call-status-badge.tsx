"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type CallStatus = "scheduled" | "completed" | "no_show" | "rescheduled" | "cancelled";
type CallOutcome = "qualified" | "needs_followup" | "not_interested" | "reschedule";

const statusConfig: Record<CallStatus, { label: string; className: string }> = {
  scheduled: {
    label: "Scheduled",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  completed: {
    label: "Completed",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  no_show: {
    label: "No Show",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  rescheduled: {
    label: "Rescheduled",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-gray-100 text-gray-500 border-gray-200",
  },
};

const outcomeConfig: Record<CallOutcome, { label: string; className: string }> = {
  qualified: {
    label: "Qualified",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  needs_followup: {
    label: "Needs Follow-up",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  not_interested: {
    label: "Not Interested",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  reschedule: {
    label: "Reschedule",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
};

interface CallStatusBadgeProps {
  status: string;
  className?: string;
}

export function CallStatusBadge({ status, className }: CallStatusBadgeProps) {
  const config = statusConfig[status as CallStatus];
  if (!config) {
    return (
      <Badge variant="outline" className={className}>
        {status}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}

interface CallOutcomeBadgeProps {
  outcome: string | null;
  className?: string;
}

export function CallOutcomeBadge({ outcome, className }: CallOutcomeBadgeProps) {
  if (!outcome) return null;

  const config = outcomeConfig[outcome as CallOutcome];
  if (!config) {
    return (
      <Badge variant="outline" className={className}>
        {outcome}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
