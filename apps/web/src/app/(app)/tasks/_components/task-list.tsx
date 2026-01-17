"use client";

import { useState } from "react";
import { format, formatDistanceToNow, isToday, isTomorrow } from "date-fns";
import {
  Phone,
  Mail,
  FileText,
  CheckCircle2,
  Circle,
  Clock,
  Building2,
  User,
  MapPin,
  AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { completeTask } from "../actions";

interface Task {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string | null;
  priority: string | null;
  due_date: string;
  due_time: string | null;
  completed_at: string | null;
  contact: { name: string } | null;
  company: { name: string } | null;
  property: { address: string } | null;
}

interface TaskListProps {
  tasks: Task[];
  emptyTitle: string;
  emptyDescription: string;
  showDate?: boolean;
  isOverdue?: boolean;
  isCompleted?: boolean;
}

const typeIcons: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  follow_up: Mail,
  review: FileText,
  other: FileText,
};

const typeLabels: Record<string, string> = {
  call: "Call",
  email: "Email",
  follow_up: "Follow-up",
  review: "Review",
  other: "Task",
};

const priorityVariants: Record<string, "default" | "warning" | "destructive"> = {
  low: "default",
  medium: "warning",
  high: "destructive",
};

function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
}

function formatDueTime(timeStr: string | null): string {
  if (!timeStr) return "";
  const [hours, minutes] = timeStr.split(":");
  const date = new Date();
  date.setHours(parseInt(hours), parseInt(minutes));
  return format(date, "h:mm a");
}

export function TaskList({
  tasks,
  emptyTitle,
  emptyDescription,
  showDate = false,
  isOverdue = false,
  isCompleted = false,
}: TaskListProps) {
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());

  async function handleComplete(taskId: string) {
    setCompletingIds((prev) => new Set(prev).add(taskId));
    try {
      await completeTask(taskId);
    } finally {
      setCompletingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title={emptyTitle}
        description={emptyDescription}
        size="default"
      />
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const Icon = typeIcons[task.type] || FileText;
        const isCompleting = completingIds.has(task.id);

        return (
          <Card
            key={task.id}
            elevation="card"
            padding="none"
            className={cn(
              "p-4 transition-opacity",
              isCompleted && "opacity-60",
              isCompleting && "opacity-50"
            )}
          >
            <div className="flex items-start gap-4">
              {/* Complete button / Status indicator */}
              <div className="pt-0.5">
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-6 w-6"
                    onClick={() => handleComplete(task.id)}
                    disabled={isCompleting}
                  >
                    <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                  </Button>
                )}
              </div>

              {/* Task content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3
                        className={cn(
                          "font-medium",
                          isCompleted && "line-through text-muted-foreground"
                        )}
                      >
                        {task.title}
                      </h3>
                      <Badge
                        variant={task.type === "call" ? "blue" : "secondary"}
                        size="sm"
                      >
                        <Icon className="h-3 w-3 mr-1" />
                        {typeLabels[task.type] || "Task"}
                      </Badge>
                      {task.priority && task.priority !== "medium" && (
                        <Badge
                          variant={priorityVariants[task.priority] || "default"}
                          size="sm"
                        >
                          {task.priority}
                        </Badge>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-body-sm text-muted-foreground mt-1 line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    {/* Context info */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-caption text-muted-foreground">
                      {task.contact && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {task.contact.name}
                        </span>
                      )}
                      {task.company && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {task.company.name}
                        </span>
                      )}
                      {task.property && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {task.property.address}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Time / Date */}
                  <div className="text-right shrink-0">
                    {isOverdue && (
                      <div className="flex items-center gap-1 text-destructive text-caption font-medium">
                        <AlertCircle className="h-3 w-3" />
                        Overdue
                      </div>
                    )}
                    {showDate && !isCompleted && (
                      <div className="text-body-sm font-medium">
                        {formatDueDate(task.due_date)}
                      </div>
                    )}
                    {task.due_time && !isCompleted && (
                      <div className="flex items-center gap-1 text-caption text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDueTime(task.due_time)}
                      </div>
                    )}
                    {isCompleted && task.completed_at && (
                      <div className="text-caption text-muted-foreground">
                        Completed{" "}
                        {formatDistanceToNow(new Date(task.completed_at), {
                          addSuffix: true,
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
