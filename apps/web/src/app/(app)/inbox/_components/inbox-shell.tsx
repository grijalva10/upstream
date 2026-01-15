"use client";

import { useEffect, useCallback } from "react";
import { MailSidebar } from "./mail-sidebar";
import { MailList } from "./mail-list";
import { MailDisplay } from "./mail-display";
import { useInbox } from "./use-inbox";
import {
  type InboxMessage,
  type InboxFilters,
  type Status,
  type Classification,
} from "@/lib/inbox/schemas";

// =============================================================================
// Types
// =============================================================================

interface InboxCounts {
  byStatus: Record<Status | "all", number>;
  byClassification: Record<Classification | "all", number>;
}

interface InboxShellProps {
  messages: InboxMessage[];
  total: number;
  filters: InboxFilters;
  counts: InboxCounts;
}

// =============================================================================
// Component
// =============================================================================

export function InboxShell({ messages, total, filters, counts }: InboxShellProps) {
  const inbox = useInbox(messages);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          inbox.selectNext();
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          inbox.selectPrevious();
          break;
        case "Escape":
          e.preventDefault();
          inbox.selectMessage(null);
          break;
      }
    },
    [inbox]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="h-full flex">
      {/* Sidebar - fixed width */}
      <div className="hidden md:block w-48 border-r flex-shrink-0 overflow-hidden">
        <MailSidebar
          statusFilter={filters.status}
          classificationFilter={filters.classification}
          statusCounts={counts.byStatus}
          classificationCounts={counts.byClassification}
          onStatusChange={inbox.setStatusFilter}
          onClassificationChange={inbox.setClassificationFilter}
        />
      </div>

      {/* Message List - fixed width */}
      <div className="w-80 border-r flex-shrink-0 overflow-hidden">
        <MailList
          messages={inbox.messages}
          selectedId={inbox.selectedMessage?.id || null}
          searchQuery={filters.search || ""}
          onSearchChange={inbox.setSearch}
          onSelectMessage={inbox.selectMessage}
          total={total}
          page={filters.page}
          limit={filters.limit}
          isPending={inbox.isPending}
        />
      </div>

      {/* Message Display - takes remaining space */}
      <div className="flex-1 overflow-hidden">
        <MailDisplay
          message={inbox.selectedMessage}
          onOptimisticUpdate={inbox.optimisticUpdateMessage}
        />
      </div>
    </div>
  );
}
