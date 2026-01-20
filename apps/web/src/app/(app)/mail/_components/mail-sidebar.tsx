"use client";

import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Flame,
  HelpCircle,
  Inbox,
  ShoppingCart,
  UserPlus,
  XCircle,
} from "lucide-react";
import {
  type Classification,
  type ViewMode,
  type ClassificationGroup,
  CLASSIFICATION_GROUPS,
} from "@/lib/inbox/schemas";

type ClassificationFilter = Classification | ClassificationGroup | "all";

// =============================================================================
// Configuration
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

interface MailSidebarProps {
  viewMode: ViewMode;
  classificationFilter: ClassificationFilter;
  viewModeCounts: Record<ViewMode, number>;
  classificationCounts: Record<string, number>;
  onViewModeChange: (viewMode: ViewMode) => void;
  onClassificationChange: (filter: ClassificationFilter) => void;
}

export function MailSidebar({
  viewMode,
  classificationFilter,
  viewModeCounts,
  classificationCounts,
  onViewModeChange,
  onClassificationChange,
}: MailSidebarProps): React.ReactElement {
  // Calculate group counts
  const getGroupCount = (groupId: ClassificationGroup) => {
    const classifications = CLASSIFICATION_GROUPS[groupId];
    return classifications.reduce(
      (sum, c) => sum + (classificationCounts[c] || 0),
      0
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* View Mode - Primary Filter */}
      <div className="p-3 space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 mb-2">
          Inbox
        </p>

        <button
          onClick={() => onViewModeChange("needs_review")}
          className={cn(
            "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
            viewMode === "needs_review"
              ? "bg-primary text-primary-foreground font-medium"
              : "hover:bg-muted"
          )}
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Needs Review
          </span>
          <span className="text-xs tabular-nums opacity-70">
            {viewModeCounts.needs_review || 0}
          </span>
        </button>

        <button
          onClick={() => onViewModeChange("auto_handled")}
          className={cn(
            "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
            viewMode === "auto_handled"
              ? "bg-primary text-primary-foreground font-medium"
              : "hover:bg-muted"
          )}
        >
          <span className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Auto-handled
          </span>
          <span className="text-xs tabular-nums opacity-70">
            {viewModeCounts.auto_handled || 0}
          </span>
        </button>

        <button
          onClick={() => onViewModeChange("all")}
          className={cn(
            "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
            viewMode === "all"
              ? "bg-primary text-primary-foreground font-medium"
              : "hover:bg-muted"
          )}
        >
          <span className="flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            All Emails
          </span>
          <span className="text-xs tabular-nums opacity-70">
            {viewModeCounts.all || 0}
          </span>
        </button>
      </div>

      <div className="border-t" />

      {/* Classification Filter - Secondary */}
      <div className="p-3 space-y-1 flex-1 overflow-y-auto">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 mb-2">
          Filter by Type
        </p>

        <button
          onClick={() => onClassificationChange("all")}
          className={cn(
            "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
            classificationFilter === "all"
              ? "bg-accent text-accent-foreground font-medium"
              : "hover:bg-muted text-muted-foreground"
          )}
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            All Types
          </span>
        </button>

        {filterGroups.map((group) => {
          const count = getGroupCount(group.id);
          const isActive = classificationFilter === group.id;
          const Icon = group.icon;

          // Hide empty groups unless active
          if (count === 0 && !isActive) return null;

          return (
            <button
              key={group.id}
              onClick={() => onClassificationChange(group.id)}
              className={cn(
                "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                <Icon className={cn("h-4 w-4", group.color)} />
                {group.label}
              </span>
              {count > 0 && (
                <span className="text-xs tabular-nums opacity-70">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
