"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type ActivityType =
  | "call"
  | "email_thread"
  | "note"
  | "deal_status_change"
  | "task_completed"
  | "created";

interface EmailInThread {
  id: string;
  direction: "inbound" | "outbound";
  from_name: string | null;
  subject: string | null;
  body_text: string;
  timestamp: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  timestamp: string;
  // For calls
  call_outcome?: string | null;
  call_notes?: string | null;
  contact_name?: string | null;
  // For email threads
  thread_subject?: string | null;
  thread_emails?: EmailInThread[];
  // For notes
  note_body?: string | null;
  // For deal status changes
  old_status?: string | null;
  new_status?: string | null;
  deal_display_id?: string | null;
  // For tasks
  task_title?: string | null;
}

interface ActivityTimelineProps {
  activities: Activity[];
  leadCreatedAt: string;
  actions?: React.ReactNode;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
}

function EmailMessage({ email }: { email: EmailInThread }) {
  const [showFull, setShowFull] = useState(false);
  const isOutbound = email.direction === "outbound";
  const needsTruncation = email.body_text.length > 500;
  const displayText = needsTruncation && !showFull
    ? email.body_text.slice(0, 300) + "..."
    : email.body_text;

  return (
    <div
      className={cn(
        "border-l-2 pl-3 py-2",
        isOutbound
          ? "border-blue-400 bg-blue-50/50 rounded-r"
          : "border-slate-200"
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-sm font-medium">
          {isOutbound ? "You" : email.from_name || "Unknown"}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDate(email.timestamp)}
        </span>
      </div>
      <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
        {displayText || <span className="italic text-muted-foreground">(No message content)</span>}
      </div>
      {needsTruncation && (
        <button
          onClick={() => setShowFull(!showFull)}
          className="text-xs text-blue-600 hover:text-blue-800 mt-2"
        >
          {showFull ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function getParticipants(emails: EmailInThread[]): string {
  const names = new Set<string>();
  let hasYou = false;

  emails.forEach((e) => {
    if (e.direction === "outbound") {
      hasYou = true;
    } else if (e.from_name) {
      names.add(e.from_name);
    }
  });

  const others = Array.from(names);
  if (hasYou && others.length === 0) return "You";
  if (!hasYou && others.length > 0) return others.join(", ");
  if (others.length === 1) return `You and ${others[0]}`;
  if (others.length === 2) return `You, ${others[0]}, and ${others[1]}`;
  return `You, ${others[0]}, and ${others.length - 1} others`;
}

function EmailThreadItem({ activity }: { activity: Activity }) {
  const [expanded, setExpanded] = useState(false);
  const emails = activity.thread_emails || [];
  const emailCount = emails.length;
  const participants = getParticipants(emails);

  return (
    <div>
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-start gap-3 w-full text-left hover:bg-muted/30 rounded-lg p-2 -m-2 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {activity.thread_subject || "No subject"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {participants} · {emailCount} {emailCount === 1 ? "message" : "messages"}
          </p>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
        )}
      </button>

      {/* Expanded thread */}
      {expanded && emails.length > 0 && (
        <div className="mt-4 space-y-4 max-h-[400px] overflow-y-auto pr-1">
          {emails.map((email) => (
            <EmailMessage key={email.id} email={email} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityCard({ activity }: { activity: Activity }) {
  const getBorderColor = (type: ActivityType): string => {
    switch (type) {
      case "call":
        return "border-green-400";
      case "email_thread":
        return "border-blue-400";
      case "note":
        return "border-amber-400";
      case "deal_status_change":
        return "border-purple-400";
      case "task_completed":
        return "border-emerald-400";
      case "created":
        return "border-slate-300";
    }
  };

  const renderContent = () => {
    switch (activity.type) {
      case "call":
        return (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                Call with {activity.contact_name || "Unknown"}
              </p>
              <span className="text-xs text-muted-foreground">{formatDate(activity.timestamp)}</span>
            </div>
            {activity.call_outcome && (
              <p className="text-xs text-muted-foreground mt-1">
                {activity.call_outcome}
              </p>
            )}
            {activity.call_notes && (
              <p className="text-sm text-foreground/80 mt-1.5 leading-relaxed">
                {activity.call_notes}
              </p>
            )}
          </>
        );

      case "email_thread":
        return (
          <>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Email</span>
              <span className="text-xs text-muted-foreground">{formatDate(activity.timestamp)}</span>
            </div>
            <EmailThreadItem activity={activity} />
          </>
        );

      case "note":
        return (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Note</span>
              <span className="text-xs text-muted-foreground">{formatDate(activity.timestamp)}</span>
            </div>
            {activity.note_body && (
              <p className="text-sm text-foreground/80 mt-1.5 leading-relaxed">
                {activity.note_body}
              </p>
            )}
          </>
        );

      case "deal_status_change":
        return (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Deal {activity.deal_display_id && `(${activity.deal_display_id})`}
              </span>
              <span className="text-xs text-muted-foreground">{formatDate(activity.timestamp)}</span>
            </div>
            <p className="text-sm mt-1">
              Status: {activity.old_status} → {activity.new_status}
            </p>
          </>
        );

      case "task_completed":
        return (
          <div className="flex items-center justify-between">
            <p className="text-sm">
              <span className="text-muted-foreground">Completed:</span>{" "}
              {activity.task_title || "Task"}
            </p>
            <span className="text-xs text-muted-foreground">{formatDate(activity.timestamp)}</span>
          </div>
        );

      case "created":
        return (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Lead created</p>
            <span className="text-xs text-muted-foreground">{formatDate(activity.timestamp)}</span>
          </div>
        );
    }
  };

  return (
    <div className={cn("border-l-2 pl-4 py-2", getBorderColor(activity.type))}>
      {renderContent()}
    </div>
  );
}

export function ActivityTimeline({ activities, leadCreatedAt, actions }: ActivityTimelineProps) {
  // Add the "created" activity
  const allActivities: Activity[] = [
    ...activities,
    {
      id: "created",
      type: "created",
      timestamp: leadCreatedAt,
    },
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Activity
        </h2>
        {actions}
      </div>

      {/* Activity list */}
      {allActivities.length === 0 ? (
        <p className="text-sm text-muted-foreground p-4">
          No activity yet
        </p>
      ) : (
        <div className="p-4 space-y-4">
          {allActivities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      )}
    </div>
  );
}
