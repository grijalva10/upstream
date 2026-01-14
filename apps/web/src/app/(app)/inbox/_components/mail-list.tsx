"use client";

import { Paperclip, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ClassificationBadge } from "@/components/classification-badge";
import { type Email } from "./use-mail";

interface MailListProps {
  emails: Email[];
  selectedId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectEmail: (id: string) => void;
}

export function MailList({
  emails,
  selectedId,
  searchQuery,
  onSearchChange,
  onSelectEmail,
}: MailListProps): React.ReactElement {
  return (
    <div className="flex h-full flex-col bg-background overflow-hidden">
      {/* Search Header */}
      <div className="flex-shrink-0 p-3 border-b bg-muted/30">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-9 bg-background"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2 px-1">
          {emails.length} {emails.length === 1 ? "email" : "emails"}
        </p>
      </div>

      {/* Email List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {emails.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            No emails found
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {emails.map((email) => (
              <MailListItem
                key={email.id}
                email={email}
                isSelected={email.id === selectedId}
                onClick={() => onSelectEmail(email.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface MailListItemProps {
  email: Email;
  isSelected: boolean;
  onClick: () => void;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  } else {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
}

function MailListItem({ email, isSelected, onClick }: MailListItemProps): React.ReactElement {
  const senderName = email.from_name || email.from_email?.split("@")[0] || "Unknown";
  const displayTime = formatTime(email.received_at);

  // Clean body preview - remove extra whitespace, signatures, etc.
  const bodyPreview = email.body_text
    ?.replace(/[\r\n]+/g, " ")
    ?.replace(/\s+/g, " ")
    ?.replace(/^(>.*?\s*)+/g, "") // Remove quoted replies
    ?.trim()
    ?.slice(0, 100) || "";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-3 transition-all duration-150",
        "hover:bg-muted/50 focus:outline-none focus:bg-muted/50",
        isSelected && "bg-muted border-l-2 border-l-primary",
        !email.is_read && "bg-primary/[0.03]"
      )}
    >
      <div className="flex gap-3">
        {/* Unread Indicator */}
        <div className="flex-shrink-0 w-1.5 pt-1.5">
          {!email.is_read && (
            <span className="block h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Row 1: Sender + Time */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "text-sm truncate",
                !email.is_read ? "font-semibold text-foreground" : "text-foreground/90"
              )}
            >
              {senderName}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {email.has_attachments && (
                <Paperclip className="h-3 w-3 text-muted-foreground" />
              )}
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {displayTime}
              </span>
            </div>
          </div>

          {/* Row 2: Subject */}
          <p
            className={cn(
              "text-sm truncate",
              !email.is_read ? "text-foreground" : "text-foreground/80"
            )}
          >
            {email.subject || "(No subject)"}
          </p>

          {/* Row 3: Preview */}
          <p className="text-xs text-muted-foreground truncate">
            {bodyPreview || "\u00A0"}
          </p>

          {/* Row 4: Tags */}
          <div className="flex items-center gap-1.5 pt-0.5">
            {email.classification && (
              <ClassificationBadge type={email.classification} size="sm" />
            )}
            {email.needs_human_review && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
                Review
              </span>
            )}
            {email.company?.name && (
              <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                {email.company.name}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
