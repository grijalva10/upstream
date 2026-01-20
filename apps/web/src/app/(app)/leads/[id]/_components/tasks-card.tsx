"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface Task {
  id: string;
  type: string;
  title: string;
  due_date: string;
  due_time: string | null;
  status: string;
}

interface TasksCardProps {
  tasks: Task[];
  leadId: string;
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

function formatType(type: string): string {
  return type.replace(/_/g, " ");
}

function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) return "Today";
  if (date.getTime() === tomorrow.getTime()) return "Tomorrow";

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TasksCard({ tasks, leadId }: TasksCardProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    type: "follow_up",
    due_date: new Date().toISOString().split("T")[0],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`/api/leads/${leadId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setDialogOpen(false);
        setFormData({
          title: "",
          type: "follow_up",
          due_date: new Date().toISOString().split("T")[0],
        });
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to create task:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (taskId: string) => {
    setCompletingId(taskId);
    try {
      const res = await fetch(`/api/leads/${leadId}/tasks/${taskId}/complete`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to complete task:", error);
    } finally {
      setCompletingId(null);
    }
  };

  // Filter to show only incomplete tasks
  const incompleteTasks = tasks.filter(
    (t) => t.status !== "completed" && t.status !== "cancelled"
  );

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Tasks
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>

        {incompleteTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">No tasks</p>
        ) : (
          <div className="divide-y">
            {incompleteTasks.map((task) => {
              const isOverdue =
                new Date(task.due_date + "T23:59:59") < new Date();
              const isCompleting = completingId === task.id;

              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2",
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
                    onClick={() => handleComplete(task.id)}
                    disabled={isCompleting}
                  >
                    {isCompleting && <Check className="h-2.5 w-2.5" />}
                  </Button>
                  <span className="flex-1 text-sm truncate">{task.title}</span>
                  <span
                    className={cn(
                      "text-xs flex-shrink-0",
                      isOverdue
                        ? "text-red-600 font-medium"
                        : "text-muted-foreground"
                    )}
                  >
                    {formatDueDate(task.due_date)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Task Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Follow up on pricing"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="call_reminder">Call Reminder</SelectItem>
                    <SelectItem value="call_prep">Call Prep</SelectItem>
                    <SelectItem value="review_deal">Review Deal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="due_date">Due Date *</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) =>
                    setFormData({ ...formData, due_date: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !formData.title}>
                {saving ? "Adding..." : "Add Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
