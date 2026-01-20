"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskItem, type Task } from "./task-item";
import { completeTask, snoozeTask } from "../actions";

export type SortOption = "oldest" | "newest" | "due_date";

const sortLabels: Record<SortOption, string> = {
  oldest: "Oldest",
  newest: "Newest",
  due_date: "Due date",
};

interface TaskListProps {
  tasks: Task[];
  emptyMessage: string;
}

export function TaskList({ tasks, emptyMessage }: TaskListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>("oldest");

  // Sort tasks client-side
  const sortedTasks = [...tasks].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return (
          new Date(b.due_date).getTime() - new Date(a.due_date).getTime()
        );
      case "due_date":
      case "oldest":
      default:
        return (
          new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        );
    }
  });

  const handleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(tasks.map((t) => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBulkComplete = async () => {
    startTransition(async () => {
      await Promise.all(
        Array.from(selectedIds).map((id) => completeTask(id))
      );
      setSelectedIds(new Set());
      router.refresh();
    });
  };

  const handleBulkSnooze = async (days: number) => {
    startTransition(async () => {
      await Promise.all(
        Array.from(selectedIds).map((id) => snoozeTask(id, days))
      );
      setSelectedIds(new Set());
      router.refresh();
    });
  };

  const isAllSelected = tasks.length > 0 && selectedIds.size === tasks.length;
  const isSomeSelected = selectedIds.size > 0;

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={isPending ? "opacity-50 pointer-events-none" : ""}>
      {/* Header row */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isAllSelected}
            onCheckedChange={handleSelectAll}
            aria-label="Select all"
          />
          <span className="text-xs text-muted-foreground">Select all</span>

          {/* Bulk actions - show when items selected */}
          {isSomeSelected && (
            <>
              <span className="text-muted-foreground/30 mx-1">|</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleBulkComplete}
              >
                <Check className="h-3 w-3 mr-1" />
                Done
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Clock className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => handleBulkSnooze(1)}>
                    Snooze 1 day
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkSnooze(3)}>
                    Snooze 3 days
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkSnooze(7)}>
                    Snooze 1 week
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <span className="text-xs text-muted-foreground">
                {selectedIds.size} selected
              </span>
            </>
          )}
        </div>

        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground">
              {sortLabels[sortBy]}
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(sortLabels) as SortOption[]).map((option) => (
              <DropdownMenuItem
                key={option}
                onClick={() => setSortBy(option)}
              >
                {sortLabels[option]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Task list */}
      <div className="border rounded-lg divide-y">
        {sortedTasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            selected={selectedIds.has(task.id)}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
}
