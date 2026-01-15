"use client";

import { useCallback, useMemo, useOptimistic, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type InboxMessage,
  type Classification,
  type Status,
  type InboxFilters,
} from "@/lib/inbox/schemas";

// =============================================================================
// Types
// =============================================================================

interface InboxState {
  messages: InboxMessage[];
  selectedId: string | null;
  filters: InboxFilters;
}

interface InboxCounts {
  byStatus: Record<Status | "all", number>;
  byClassification: Record<Classification | "all", number>;
}

interface UseInboxReturn {
  // Data
  messages: InboxMessage[];
  selectedMessage: InboxMessage | null;
  counts: InboxCounts;

  // Filters
  filters: InboxFilters;
  setStatusFilter: (status: Status | "all") => void;
  setClassificationFilter: (classification: Classification | "all") => void;
  setSearch: (search: string) => void;

  // Selection
  selectMessage: (id: string | null) => void;
  selectNext: () => void;
  selectPrevious: () => void;

  // Optimistic updates
  optimisticUpdateMessage: (id: string, updates: Partial<InboxMessage>) => void;

  // Loading state
  isPending: boolean;
}

// =============================================================================
// URL State Management
// =============================================================================

function getFiltersFromUrl(searchParams: URLSearchParams): InboxFilters {
  return {
    status: (searchParams.get("status") as Status | "all") || "all",
    classification: (searchParams.get("classification") as Classification | "all") || "all",
    search: searchParams.get("search") || undefined,
    page: parseInt(searchParams.get("page") || "1", 10),
    limit: parseInt(searchParams.get("limit") || "50", 10),
  };
}

function buildUrl(baseFilters: InboxFilters, updates: Partial<InboxFilters>): string {
  const filters = { ...baseFilters, ...updates };
  const params = new URLSearchParams();

  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.classification !== "all") params.set("classification", filters.classification);
  if (filters.search) params.set("search", filters.search);
  if (filters.page > 1) params.set("page", String(filters.page));

  const queryString = params.toString();
  return queryString ? `/inbox?${queryString}` : "/inbox";
}

// =============================================================================
// Count Calculation
// =============================================================================

function calculateCounts(messages: InboxMessage[]): InboxCounts {
  const byStatus: Record<string, number> = { all: messages.length };
  const byClassification: Record<string, number> = { all: messages.length };

  for (const msg of messages) {
    byStatus[msg.status] = (byStatus[msg.status] || 0) + 1;
    const classification = msg.classification || "unclassified";
    byClassification[classification] = (byClassification[classification] || 0) + 1;
  }

  return {
    byStatus: byStatus as InboxCounts["byStatus"],
    byClassification: byClassification as InboxCounts["byClassification"],
  };
}

// =============================================================================
// Hook
// =============================================================================

export function useInbox(initialMessages: InboxMessage[]): UseInboxReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Parse filters from URL
  const filters = useMemo(() => getFiltersFromUrl(searchParams), [searchParams]);

  // Get selected ID from URL
  const selectedId = searchParams.get("selected");

  // Optimistic state for messages
  const [optimisticMessages, updateOptimisticMessages] = useOptimistic(
    initialMessages,
    (state: InboxMessage[], update: { id: string; changes: Partial<InboxMessage> }) => {
      return state.map((msg) =>
        msg.id === update.id ? { ...msg, ...update.changes } : msg
      );
    }
  );

  // Calculate counts from optimistic messages
  const counts = useMemo(() => calculateCounts(optimisticMessages), [optimisticMessages]);

  // Find selected message
  const selectedMessage = useMemo(() => {
    if (!selectedId) return null;
    return optimisticMessages.find((m) => m.id === selectedId) || null;
  }, [optimisticMessages, selectedId]);

  // Navigation helper
  const navigate = useCallback(
    (url: string) => {
      startTransition(() => {
        router.push(url, { scroll: false });
      });
    },
    [router]
  );

  // Filter setters
  const setStatusFilter = useCallback(
    (status: Status | "all") => {
      navigate(buildUrl(filters, { status, page: 1 }));
    },
    [filters, navigate]
  );

  const setClassificationFilter = useCallback(
    (classification: Classification | "all") => {
      navigate(buildUrl(filters, { classification, page: 1 }));
    },
    [filters, navigate]
  );

  const setSearch = useCallback(
    (search: string) => {
      navigate(buildUrl(filters, { search: search || undefined, page: 1 }));
    },
    [filters, navigate]
  );

  // Selection
  const selectMessage = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) {
        params.set("selected", id);
      } else {
        params.delete("selected");
      }
      const queryString = params.toString();
      navigate(queryString ? `/inbox?${queryString}` : "/inbox");
    },
    [searchParams, navigate]
  );

  const selectNext = useCallback(() => {
    if (optimisticMessages.length === 0) return;
    const currentIndex = selectedId
      ? optimisticMessages.findIndex((m) => m.id === selectedId)
      : -1;
    const nextIndex = Math.min(currentIndex + 1, optimisticMessages.length - 1);
    selectMessage(optimisticMessages[nextIndex].id);
  }, [optimisticMessages, selectedId, selectMessage]);

  const selectPrevious = useCallback(() => {
    if (optimisticMessages.length === 0) return;
    const currentIndex = selectedId
      ? optimisticMessages.findIndex((m) => m.id === selectedId)
      : optimisticMessages.length;
    const prevIndex = Math.max(currentIndex - 1, 0);
    selectMessage(optimisticMessages[prevIndex].id);
  }, [optimisticMessages, selectedId, selectMessage]);

  // Optimistic update
  const optimisticUpdateMessage = useCallback(
    (id: string, updates: Partial<InboxMessage>) => {
      startTransition(() => {
        updateOptimisticMessages({ id, changes: updates });
      });
    },
    [updateOptimisticMessages]
  );

  return {
    messages: optimisticMessages,
    selectedMessage,
    counts,
    filters,
    setStatusFilter,
    setClassificationFilter,
    setSearch,
    selectMessage,
    selectNext,
    selectPrevious,
    optimisticUpdateMessage,
    isPending,
  };
}
