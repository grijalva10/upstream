"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Check,
  Clock,
  MoreHorizontal,
  Mail,
  Phone,
  FileText,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
}

// Task type to icon and color mapping
function getTaskTypeStyle(type: string): {
  icon: typeof Mail;
  bgColor: string;
  iconColor: string;
} {
  switch (type) {
    case "incoming_email":
    case "email_followup":
      return {
        icon: Mail,
        bgColor: "bg-blue-100",
        iconColor: "text-blue-600",
      };
    case "outgoing_call":
      return {
        icon: Phone,
        bgColor: "bg-green-100",
        iconColor: "text-green-600",
      };
    case "deal":
      return {
        icon: Briefcase,
        bgColor: "bg-purple-100",
        iconColor: "text-purple-600",
      };
    case "lead":
    default:
      return {
        icon: FileText,
        bgColor: "bg-orange-100",
        iconColor: "text-orange-600",
      };
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
    return `${dateLabel}, ${timeLabel}`;
  }

  return dateLabel;
}

export function TaskItem({ task, selected, onSelect }: TaskItemProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleComplete = async () => {
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

  const handleCheckboxChange = (checked: boolean) => {
    onSelect?.(task.id, checked);
  };

  const isOverdue =
    new Date(task.due_date + "T23:59:59") < new Date() &&
    task.status !== "completed" &&
    task.status !== "cancelled";

  const typeStyle = getTaskTypeStyle(task.type);
  const TypeIcon = typeStyle.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 transition-colors",
        task.lead_id && "cursor-pointer hover:bg-muted/50",
        isPending && "opacity-50",
        isOverdue && "bg-red-50/50",
        selected && "bg-muted/30"
      )}
    >
      {/* Checkbox */}
      <Checkbox
        checked={selected}
        onCheckedChange={handleCheckboxChange}
        onClick={(e) => e.stopPropagation()}
        className="flex-shrink-0"
      />

      {/* Type icon */}
      <div
        className={cn(
          "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0",
          typeStyle.bgColor
        )}
        onClick={handleRowClick}
      >
        <TypeIcon className={cn("h-3.5 w-3.5", typeStyle.iconColor)} />
      </div>

      {/* Lead name - fixed width for alignment */}
      <span
        className="text-sm font-medium truncate w-[140px] flex-shrink-0"
        onClick={handleRowClick}
      >
        {task.lead_name || ""}
      </span>

      {/* Content - in the middle */}
      <div className="flex-1 min-w-0 overflow-hidden px-8" onClick={handleRowClick}>
        <span className="text-sm text-muted-foreground truncate block">{task.title}</span>
        {task.type === "incoming_email" && task.subject && (
          <span className="text-xs text-muted-foreground/70 truncate block">
            {task.subject}
          </span>
        )}
      </div>

      <span
        className={cn(
          "text-xs flex-shrink-0",
          isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"
        )}
        onClick={handleRowClick}
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
          <DropdownMenuItem onClick={handleComplete}>
            <Check className="h-4 w-4 mr-2" />
            Mark as done
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Clock className="h-4 w-4 mr-2" />
              Snooze
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => handleSnooze(1)}>
                1 day
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSnooze(3)}>
                3 days
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSnooze(7)}>
                1 week
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
