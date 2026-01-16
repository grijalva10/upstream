"use client";

import {
  Search,
  MapPin,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileEdit,
  AlertCircle,
  Bot,
  Inbox,
  Filter,
  Flame,
  HelpCircle,
  ShoppingCart,
  UserPlus,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import { format, isToday, isYesterday, isThisWeek, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ClassificationBadge } from "@/components/classification-badge";
import {
  type InboxMessage,
  type Classification,
  type ViewMode,
  type ClassificationGroup,
  CLASSIFICATION_GROUPS,
} from "@/lib/inbox/schemas";
import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// =============================================================================
// Types
// =============================================================================

type ClassificationFilter = Classification | ClassificationGroup | "all";

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
  // Filter props
  viewMode?: ViewMode;
  classificationFilter?: ClassificationFilter;
  viewModeCounts?: Record<ViewMode, number>;
  classificationCounts?: Record<string, number>;
  onViewModeChange?: (viewMode: ViewMode) => void;
  onClassificationChange?: (filter: ClassificationFilter) => void;
}

// =============================================================================
// Filter Configuration
// =============================================================================

interface FilterGroup {
  id: ClassificationGroup;
  label: string;
  icon: React.ElementType;
  color: string;
}

const filterGroups: FilterGroup[] = [
  { id: "hot", label: "Hot Leads", icon: Flame, color: "text-green-500" },
  { id: "qualify", label: "Questions", icon: HelpCircle, color: "text-yellow-500" },
  { id: "buyer", label: "Buyers", icon: ShoppingCart, color: "text-cyan-500" },
  { id: "redirect", label: "Redirects", icon: UserPlus, color: "text-orange-500" },
  { id: "closed", label: "Closed", icon: XCircle, color: "text-muted-foreground" },
];

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
  // Filter props with defaults
  viewMode = "needs_review",
  classificationFilter = "all",
  viewModeCounts = { needs_review: 0, auto_handled: 0, all: 0 },
  classificationCounts = {},
  onViewModeChange,
  onClassificationChange,
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

  // Calculate group counts for classification filter
  const getGroupCount = (groupId: ClassificationGroup) => {
    const classifications = CLASSIFICATION_GROUPS[groupId];
    return classifications.reduce(
      (sum, c) => sum + (classificationCounts[c] || 0),
      0
    );
  };

  // Get current filter label for dropdown
  const getFilterLabel = () => {
    if (classificationFilter === "all") return "All Types";
    const group = filterGroups.find((g) => g.id === classificationFilter);
    return group?.label || "All Types";
  };

  // Get current filter icon for dropdown
  const getFilterIcon = () => {
    if (classificationFilter === "all") return CheckCircle2;
    const group = filterGroups.find((g) => g.id === classificationFilter);
    return group?.icon || Filter;
  };

  const FilterIcon = getFilterIcon();
  const filterColor = classificationFilter !== "all"
    ? filterGroups.find((g) => g.id === classificationFilter)?.color
    : undefined;

  return (
    <div className="flex h-full flex-col bg-background overflow-hidden">
      {/* Filter Header */}
      <div className="flex-shrink-0 border-b bg-muted/30">
        {/* View Mode Tabs */}
        {onViewModeChange && (
          <div className="p-2 pb-0">
            <div className="flex bg-muted rounded-lg p-0.5">
              <button
                onClick={() => onViewModeChange("needs_review")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all",
                  viewMode === "needs_review"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <AlertCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Review</span>
                {viewModeCounts.needs_review > 0 && (
                  <span className="tabular-nums text-[10px] bg-primary/10 text-primary px-1 rounded">
                    {viewModeCounts.needs_review}
                  </span>
                )}
              </button>
              <button
                onClick={() => onViewModeChange("auto_handled")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all",
                  viewMode === "auto_handled"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Bot className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Auto</span>
                {viewModeCounts.auto_handled > 0 && (
                  <span className="tabular-nums text-[10px] opacity-70">
                    {viewModeCounts.auto_handled}
                  </span>
                )}
              </button>
              <button
                onClick={() => onViewModeChange("all")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all",
                  viewMode === "all"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Inbox className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">All</span>
                {viewModeCounts.all > 0 && (
                  <span className="tabular-nums text-[10px] opacity-70">
                    {viewModeCounts.all}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Search and Classification Filter Row */}
        <div className="p-2 space-y-2">
          <div className="flex gap-2">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={localSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8 h-8 text-sm bg-background"
                aria-label="Search messages"
              />
              {isPending && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />
              )}
            </div>

            {/* Classification Filter Dropdown */}
            {onClassificationChange && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={classificationFilter !== "all" ? "secondary" : "outline"}
                    size="sm"
                    className={cn(
                      "h-8 px-2.5 gap-1.5 flex-shrink-0",
                      classificationFilter !== "all" && "bg-accent"
                    )}
                  >
                    <FilterIcon className={cn("h-3.5 w-3.5", filterColor)} />
                    <span className="text-xs max-w-[60px] truncate hidden sm:inline">
                      {getFilterLabel()}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => onClassificationChange("all")}
                    className={cn(
                      classificationFilter === "all" && "bg-accent"
                    )}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    All Types
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {filterGroups.map((group) => {
                    const count = getGroupCount(group.id);
                    const isActive = classificationFilter === group.id;
                    const Icon = group.icon;

                    return (
                      <DropdownMenuItem
                        key={group.id}
                        onClick={() => onClassificationChange(group.id)}
                        className={cn(isActive && "bg-accent")}
                      >
                        <Icon className={cn("h-4 w-4 mr-2", group.color)} />
                        <span className="flex-1">{group.label}</span>
                        {count > 0 && (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {count}
                          </span>
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Count and Pagination */}
          <div className="flex items-center justify-between px-0.5">
            <p className="text-[11px] text-muted-foreground">
              {total} {total === 1 ? "message" : "messages"}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => goToPage(page - 1)}
                  disabled={!hasPrev || isPending}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[11px] text-muted-foreground tabular-nums px-1">
                  {page}/{totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => goToPage(page + 1)}
                  disabled={!hasNext || isPending}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
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
  try {
    const date = parseISO(dateStr);
    if (isToday(date)) {
      return format(date, "h:mm a");
    } else if (isYesterday(date)) {
      return "Yesterday";
    } else if (isThisWeek(date)) {
      return format(date, "EEE");
    } else {
      return format(date, "MMM d");
    }
  } catch {
    return "";
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
