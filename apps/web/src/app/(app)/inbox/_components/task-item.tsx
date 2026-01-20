"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Clock, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  subject: string | null;
  due_date: string;
  due_time: string | null;
  status: string;
  lead_id: string | null;
  lead_name: string | null;
}

interface TaskItemProps {
  task: Task;
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
    return `${dateLabel}, ${timeLabel}`;
  }

  return dateLabel;
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
        "flex items-center gap-3 px-3 py-2 transition-colors",
        task.lead_id && "cursor-pointer hover:bg-muted/50",
        isPending && "opacity-50",
        isOverdue && "bg-red-50/50"
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-4 w-4 rounded-full border flex-shrink-0",
          isCompleting
            ? "border-green-500 bg-green-500 text-white"
            : "border-muted-foreground/40 hover:border-green-500"
        )}
        onClick={handleComplete}
        disabled={isPending}
      >
        {isCompleting && <Check className="h-2.5 w-2.5" />}
      </Button>

      <div className="flex-1 min-w-0">
        <span className="text-sm truncate block">{task.title}</span>
        {task.type === "incoming_email" && task.subject && (
          <span className="text-xs text-muted-foreground truncate block">
            {task.subject}
          </span>
        )}
      </div>

      {task.lead_name && (
        <span className="text-xs text-muted-foreground truncate max-w-[120px] flex-shrink-0">
          {task.lead_name}
        </span>
      )}

      <span
        className={cn(
          "text-xs flex-shrink-0",
          isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"
        )}
      >
        {formatDueDate(task.due_date, task.due_time)}
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0">
            <MoreHorizontal className="h-3.5 w-3.5" />
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
  );
}
