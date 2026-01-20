"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Clock, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { completeTask, snoozeTask } from "../actions";

export interface Task {
  id: string;
  type: string;
  title: string;
  description: string | null;
  due_date: string;
  due_time: string | null;
  status: string;
  lead_id: string | null;
  lead_name: string | null;
}

interface TaskItemProps {
  task: Task;
}

function getTypeColor(type: string): string {
  switch (type) {
    case "call_reminder":
      return "bg-blue-100 text-blue-800";
    case "follow_up":
      return "bg-amber-100 text-amber-800";
    case "review_deal":
      return "bg-purple-100 text-purple-800";
    case "call_prep":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function formatDueDate(dateStr: string, timeStr: string | null): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let dateLabel: string;
  if (date.getTime() === today.getTime()) {
    dateLabel = "Today";
  } else if (date.getTime() === tomorrow.getTime()) {
    dateLabel = "Tomorrow";
  } else if (date.getTime() === yesterday.getTime()) {
    dateLabel = "Yesterday";
  } else {
    dateLabel = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  if (timeStr) {
    const [hours, minutes] = timeStr.split(":");
    const time = new Date();
    time.setHours(parseInt(hours), parseInt(minutes));
    const timeLabel = time.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${dateLabel} at ${timeLabel}`;
  }

  return dateLabel;
}

function formatType(type: string): string {
  return type.replace(/_/g, " ");
}

export function TaskItem({ task }: TaskItemProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCompleting, setIsCompleting] = useState(false);

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCompleting(true);
    startTransition(async () => {
      await completeTask(task.id);
      router.refresh();
    });
  };

  const handleSnooze = async (days: number) => {
    startTransition(async () => {
      await snoozeTask(task.id, days);
      router.refresh();
    });
  };

  const handleRowClick = () => {
    if (task.lead_id) {
      router.push(`/leads/${task.lead_id}`);
    }
  };

  const isOverdue =
    new Date(task.due_date + "T23:59:59") < new Date() &&
    task.status !== "completed" &&
    task.status !== "cancelled";

  return (
    <div
      onClick={handleRowClick}
      className={cn(
        "flex items-center gap-3 p-3 border rounded-lg transition-colors",
        task.lead_id && "cursor-pointer hover:bg-muted/50",
        isPending && "opacity-50",
        isOverdue && "border-red-200 bg-red-50/50"
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-6 w-6 rounded-full border-2 flex-shrink-0",
          isCompleting
            ? "border-green-500 bg-green-500 text-white"
            : "border-muted-foreground/30 hover:border-green-500"
        )}
        onClick={handleComplete}
        disabled={isPending}
      >
        {isCompleting && <Check className="h-3 w-3" />}
      </Button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{task.title}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {task.lead_name && (
            <>
              <span className="truncate">{task.lead_name}</span>
              <span>·</span>
            </>
          )}
          <Badge variant="secondary" className={cn("text-xs", getTypeColor(task.type))}>
            {formatType(task.type)}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className={cn(
            "text-sm",
            isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"
          )}
        >
          {formatDueDate(task.due_date, task.due_time)}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleSnooze(1)}>
              <Clock className="h-4 w-4 mr-2" />
              Snooze 1 day
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSnooze(3)}>
              <Clock className="h-4 w-4 mr-2" />
              Snooze 3 days
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSnooze(7)}>
              <Clock className="h-4 w-4 mr-2" />
              Snooze 1 week
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
