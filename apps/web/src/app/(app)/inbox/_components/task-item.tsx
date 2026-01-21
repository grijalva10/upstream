"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock,
  MoreHorizontal,
  Mail,
  Phone,
  FileText,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Send,
  Pencil,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusDot } from "@/components/ui/status-dot";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { completeTask, snoozeTask } from "../actions";

export interface EmailDraft {
  id: string;
  subject: string;
  body: string;
  to_email: string;
  to_name: string | null;
  status: string;
  context_brief: string | null;
}

export interface ThreadMessage {
  id: string;
  from_email: string;
  from_name: string | null;
  body_text: string | null;
  direction: string;
  received_at: string;
}

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
  contact_id: string | null;
  draft: EmailDraft | null;
  thread: ThreadMessage[];
  property_address: string | null;
  classification: string | null;
}

interface TaskItemProps {
  task: Task;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
}

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
        bgColor: "bg-primary/10",
        iconColor: "text-primary",
      };
    case "outgoing_call":
      return {
        icon: Phone,
        bgColor: "bg-muted",
        iconColor: "text-foreground",
      };
    case "deal":
      return {
        icon: Briefcase,
        bgColor: "bg-muted",
        iconColor: "text-foreground",
      };
    case "lead":
    default:
      return {
        icon: FileText,
        bgColor: "bg-muted",
        iconColor: "text-muted-foreground",
      };
  }
}

function getClassificationLabel(classification: string | null) {
  switch (classification) {
    case "hot":
      return "Hot";
    case "question":
      return "Question";
    default:
      return null;
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

function truncateText(text: string | null, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

export function TaskItem({ task, selected, onSelect }: TaskItemProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(task.draft?.body || "");
  const [actionPending, setActionPending] = useState(false);

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

  const handleReopen = async () => {
    setActionPending(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/reopen`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to reopen");
      }
    } catch (err) {
      alert("Failed to reopen task");
    } finally {
      setActionPending(false);
    }
  };

  const handleApprove = async () => {
    if (!task.draft) return;
    setActionPending(true);
    try {
      const res = await fetch(`/api/email-drafts/${task.draft.id}/approve`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to approve");
      }
    } catch (err) {
      alert("Failed to approve draft");
    } finally {
      setActionPending(false);
    }
  };

  const handleReject = async () => {
    if (!task.draft) return;
    setActionPending(true);
    try {
      const res = await fetch(`/api/email-drafts/${task.draft.id}/reject`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      }
    } catch (err) {
      alert("Failed to reject draft");
    } finally {
      setActionPending(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!task.draft) return;
    setActionPending(true);
    try {
      const res = await fetch(`/api/email-drafts/${task.draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editedBody }),
      });
      if (res.ok) {
        setIsEditing(false);
        router.refresh();
      }
    } catch (err) {
      alert("Failed to save edit");
    } finally {
      setActionPending(false);
    }
  };

  const handleCheckboxChange = (checked: boolean) => {
    onSelect?.(task.id, checked);
  };

  const isOverdue =
    new Date(task.due_date + "T23:59:59") < new Date() &&
    task.status !== "completed" &&
    task.status !== "cancelled";

  const isArchived = task.status === "completed" || task.status === "cancelled";

  const typeStyle = getTaskTypeStyle(task.type);
  const TypeIcon = typeStyle.icon;
  const classificationLabel = getClassificationLabel(task.classification);
  const hasEmailContext = task.type === "incoming_email" && (task.draft || task.thread.length > 0);

  // Get the last inbound message for preview
  const lastInbound = task.thread.filter(m => m.direction === "inbound").pop();

  return (
    <div
      className={cn(
        "border-b transition-colors",
        isPending && "opacity-50",
        isOverdue && "bg-destructive/5",
        selected && "bg-muted/30"
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-3 py-2">
        <Checkbox
          checked={selected}
          onCheckedChange={handleCheckboxChange}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0"
        />

        <div
          className={cn(
            "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0",
            typeStyle.bgColor
          )}
        >
          <TypeIcon className={cn("h-3.5 w-3.5", typeStyle.iconColor)} />
        </div>

        {/* Lead name */}
        <span
          className="text-sm font-medium truncate w-[140px] flex-shrink-0 cursor-pointer hover:underline"
          onClick={() => task.lead_id && router.push(`/leads/${task.lead_id}`)}
        >
          {task.lead_name || "Unknown"}
        </span>

        {/* Classification indicator */}
        {task.classification && classificationLabel && (
          <StatusDot status={task.classification} label={classificationLabel} />
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <span className="text-sm text-muted-foreground truncate block">
            {task.title}
          </span>
          {task.property_address && (
            <span className="text-xs text-muted-foreground/70 truncate block">
              {task.property_address}
            </span>
          )}
        </div>

        <span
          className={cn(
            "text-xs flex-shrink-0",
            isOverdue ? "text-destructive font-medium" : "text-muted-foreground"
          )}
        >
          {formatDueDate(task.due_date, task.due_time)}
        </span>

        {/* Expand button for email tasks */}
        {hasEmailContext && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isArchived ? (
              <>
                <DropdownMenuItem onClick={handleReopen}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reopen
                </DropdownMenuItem>
                {task.lead_id && (
                  <DropdownMenuItem onClick={() => router.push(`/leads/${task.lead_id}`)}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Lead
                  </DropdownMenuItem>
                )}
              </>
            ) : (
              <>
                <DropdownMenuItem onClick={handleComplete}>
                  <Check className="h-4 w-4 mr-2" />
                  Mark as done
                </DropdownMenuItem>
                {task.lead_id && (
                  <DropdownMenuItem onClick={() => router.push(`/leads/${task.lead_id}`)}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Lead
                  </DropdownMenuItem>
                )}
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
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Expanded content for email tasks */}
      {hasEmailContext && isExpanded && (
        <div className="px-3 pb-3 ml-[52px] space-y-3">
          {/* Thread preview */}
          {task.thread.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground p-0 h-auto">
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Thread ({task.thread.length} messages)
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {task.thread.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "text-xs p-2 rounded",
                      msg.direction === "inbound"
                        ? "bg-muted/50 border-l-2 border-primary/50"
                        : "bg-muted/30 border-l-2 border-muted-foreground/30"
                    )}
                  >
                    <div className="font-medium mb-1">
                      {msg.from_name || msg.from_email}
                      <span className="font-normal text-muted-foreground ml-2">
                        {new Date(msg.received_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-muted-foreground whitespace-pre-wrap">
                      {truncateText(msg.body_text, 500)}
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Context brief (AI-generated summary) */}
          {task.draft?.context_brief && (
            <div className="text-sm p-3 rounded-lg bg-muted/50 border border-border">
              <div className="font-medium text-muted-foreground mb-1 text-xs uppercase tracking-wide">
                Context
              </div>
              <div className="text-foreground">
                {task.draft.context_brief}
              </div>
            </div>
          )}

          {/* Last inbound message preview (always visible) */}
          {lastInbound && !isEditing && (
            <div className="text-xs p-2 rounded bg-muted/30 border-l-2 border-primary/50">
              <div className="font-medium mb-1 text-foreground">
                Their message:
              </div>
              <div className="text-muted-foreground whitespace-pre-wrap">
                {truncateText(lastInbound.body_text, 300)}
              </div>
            </div>
          )}

          {/* Draft preview/edit */}
          {task.draft && (
            <div className="border rounded-lg p-3 bg-background">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  AI Draft Reply
                </span>
                {!isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => {
                      setEditedBody(task.draft!.body);
                      setIsEditing(true);
                    }}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  <Textarea
                    value={editedBody}
                    onChange={(e) => setEditedBody(e.target.value)}
                    className="min-h-[120px] text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={actionPending}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {task.draft.body}
                </div>
              )}

              {/* Action buttons */}
              {!isEditing && (
                <div className="flex gap-2 mt-3 pt-3 border-t">
                  <Button
                    size="sm"
                    onClick={handleApprove}
                    disabled={actionPending}
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Approve & Send
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReject}
                    disabled={actionPending}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Done (Don't Send)
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* No draft - just show complete/snooze */}
          {!task.draft && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleComplete}>
                <Check className="h-3 w-3 mr-1" />
                Mark Done
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleSnooze(1)}>
                <Clock className="h-3 w-3 mr-1" />
                Snooze
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
