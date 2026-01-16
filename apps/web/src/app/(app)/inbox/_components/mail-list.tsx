"use client";

import { Search, MapPin, Loader2, ChevronLeft, ChevronRight, FileEdit, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ClassificationBadge } from "@/components/classification-badge";
import { type InboxMessage, type Classification } from "@/lib/inbox/schemas";
import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";

// =============================================================================
// Types
// =============================================================================

interface MailListProps {
  messages: InboxMessage[];
  selectedId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectMessage: (id: string) => void;
  total?: number;
  page?: number;
  limit?: number;
  isPending?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function MailList({
  messages,
  selectedId,
  searchQuery,
  onSearchChange,
  onSelectMessage,
  total = messages.length,
  page = 1,
  limit = 20,
  isPending = false,
}: MailListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Debounce search to avoid too many URL updates
  const debouncedSearch = useDebouncedCallback((value: string) => {
    onSearchChange(value);
  }, 300);

  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value);
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  // Pagination
  const totalPages = Math.ceil((total ?? 0) / (limit || 1));
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  const goToPage = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newPage > 1) {
        params.set("page", String(newPage));
      } else {
        params.delete("page");
      }
      router.push(`/inbox?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <div className="flex h-full flex-col bg-background overflow-hidden">
      {/* Search Header */}
      <div className="flex-shrink-0 p-3 border-b bg-muted/30">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-8 h-9 bg-background"
            aria-label="Search messages"
          />
          {isPending && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          )}
        </div>
        <div className="flex items-center justify-between mt-2 px-1">
          <p className="text-xs text-muted-foreground">
            {total} {total === 1 ? "message" : "messages"}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => goToPage(page - 1)}
                disabled={!hasPrev || isPending}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                {page}/{totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => goToPage(page + 1)}
                disabled={!hasNext || isPending}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Message List */}
      <div
        className={cn(
          "flex-1 min-h-0 overflow-y-auto",
          isPending && "opacity-60"
        )}
        role="listbox"
        aria-label="Messages"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            No messages found
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {messages.map((message) => (
              <MailListItem
                key={message.id}
                message={message}
                isSelected={message.id === selectedId}
                onClick={() => onSelectMessage(message.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// List Item
// =============================================================================

interface MailListItemProps {
  message: InboxMessage;
  isSelected: boolean;
  onClick: () => void;
}

function formatTime(dateStr: string | null | undefined): string {
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

function MailListItem({ message, isSelected, onClick }: MailListItemProps) {
  const senderName = message.from_name || message.from_email?.split("@")[0] || "Unknown";
  const displayTime = formatTime(message.received_at);
  const isNew = message.status === "new";

  // Clean body preview
  const bodyPreview = message.body_text
    ?.replace(/[\r\n]+/g, " ")
    ?.replace(/\s+/g, " ")
    ?.replace(/^(>.*?\s*)+/g, "")
    ?.trim()
    ?.slice(0, 100) || "";

  // Property location if available (from flattened inbox_view fields)
  const propertyLocation = message.property_address || message.property_name || null;

  // Show indicators for review needed and draft pending
  const hasDraft = !!message.draft_id;
  const showReviewIndicator = message.needs_review && message.status === "new";

  return (
    <button
      onClick={onClick}
      role="option"
      aria-selected={isSelected}
      className={cn(
        "w-full text-left px-3 py-3 transition-all duration-150",
        "hover:bg-muted/50 focus:outline-none focus:bg-muted/50",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        isSelected && "bg-muted border-l-2 border-l-primary",
        isNew && "bg-primary/[0.03]"
      )}
    >
      <div className="flex gap-3">
        {/* Unread Indicator */}
        <div className="flex-shrink-0 w-1.5 pt-1.5">
          {isNew && (
            <span
              className="block h-1.5 w-1.5 rounded-full bg-primary"
              aria-label="Unread"
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Row 1: Sender + Time */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "text-sm truncate",
                isNew ? "font-semibold text-foreground" : "text-foreground/90"
              )}
            >
              {senderName}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {displayTime}
              </span>
            </div>
          </div>

          {/* Row 2: Subject */}
          <p
            className={cn(
              "text-sm truncate",
              isNew ? "text-foreground" : "text-foreground/80"
            )}
          >
            {message.subject || "(No subject)"}
          </p>

          {/* Row 3: Preview */}
          <p className="text-xs text-muted-foreground truncate">
            {bodyPreview || "\u00A0"}
          </p>

          {/* Row 4: Tags and Property */}
          <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
            {message.classification && (
              <ClassificationBadge type={message.classification as Classification} size="sm" />
            )}
            {showReviewIndicator && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <AlertCircle className="h-2.5 w-2.5" />
                Review
              </span>
            )}
            {hasDraft && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-600 border border-blue-500/20">
                <FileEdit className="h-2.5 w-2.5" />
                Draft
              </span>
            )}
            {message.status === "actioned" && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/10 text-green-600 border border-green-500/20">
                Done
              </span>
            )}
            {propertyLocation && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground truncate max-w-[140px]">
                <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                {propertyLocation}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
