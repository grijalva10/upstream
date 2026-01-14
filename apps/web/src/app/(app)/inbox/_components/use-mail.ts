"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type ClassificationType } from "@/components/classification-badge";

export interface ExtractedPricing {
  asking_price?: number;
  noi?: number;
  cap_rate?: number;
  price_per_sf?: number;
}

export interface Email {
  id: string;
  outlook_entry_id: string;
  outlook_conversation_id: string | null;
  direction: "inbound" | "outbound";
  from_email: string | null;
  from_name: string | null;
  to_emails: string[] | null;
  cc_emails: string[] | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: string | null;
  sent_at: string | null;
  is_read: boolean;
  has_attachments: boolean;
  matched_contact_id: string | null;
  matched_company_id: string | null;
  linked_activity_id: string | null;
  classification: ClassificationType | null;
  classification_confidence: number | null;
  extracted_pricing: ExtractedPricing | null;
  needs_human_review: boolean;
  classified_at: string | null;
  classified_by: string | null;
  synced_at: string;
  created_at: string;
  source_folder: string | null;
  company?: { name: string } | null;
  contact?: { name: string; title?: string } | null;
}

export type FilterType = ClassificationType | "all" | "needs_review";

export type FolderType = "all" | "Inbox" | "Sent Items" | "Archive" | "Drafts" | "Junk Email";

export interface ClassificationCount {
  classification: ClassificationType | null;
  count: number;
  needs_review_count: number;
}

export interface FolderCount {
  folder: string | null;
  count: number;
}

function updateUrlParam(
  searchParams: URLSearchParams,
  key: string,
  value: string | null
): URLSearchParams {
  const params = new URLSearchParams(searchParams.toString());
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
  return params;
}

function matchesSearch(email: Email, query: string): boolean {
  const lowerQuery = query.toLowerCase();
  return (
    email.subject?.toLowerCase().includes(lowerQuery) ||
    email.from_email?.toLowerCase().includes(lowerQuery) ||
    email.from_name?.toLowerCase().includes(lowerQuery) ||
    email.body_text?.toLowerCase().includes(lowerQuery) ||
    email.company?.name?.toLowerCase().includes(lowerQuery) ||
    false
  );
}

export interface UseMail {
  emails: Email[];
  selectedEmail: Email | null;
  folder: FolderType;
  filter: FilterType;
  searchQuery: string;
  counts: Record<string, number>;
  folderCounts: Record<string, number>;
  setFolder: (folder: FolderType) => void;
  setFilter: (filter: FilterType) => void;
  setSearchQuery: (query: string) => void;
  selectEmail: (id: string | null) => void;
  selectNextEmail: () => void;
  selectPreviousEmail: () => void;
}

export function useMail(
  initialEmails: Email[],
  initialCounts: ClassificationCount[],
  initialFolderCounts: FolderCount[] = []
): UseMail {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlFolder = (searchParams.get("folder") as FolderType) || "all";
  const urlFilter = (searchParams.get("filter") as FilterType) || "all";
  const urlSelected = searchParams.get("selected");

  const [folder, setFolderState] = useState<FolderType>(urlFolder);
  const [filter, setFilterState] = useState<FilterType>(urlFilter);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(urlSelected);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: 0, needs_review: 0 };

    for (const item of initialCounts) {
      const key = item.classification || "unclassified";
      result[key] = (result[key] || 0) + item.count;
      result.all += item.count;
      result.needs_review += item.needs_review_count;
    }

    return result;
  }, [initialCounts]);

  const folderCounts = useMemo(() => {
    const result: Record<string, number> = { all: 0 };

    for (const item of initialFolderCounts) {
      const key = item.folder || "Other";
      result[key] = (result[key] || 0) + item.count;
      result.all += item.count;
    }

    return result;
  }, [initialFolderCounts]);

  const filteredEmails = useMemo(() => {
    let emails = initialEmails;

    // Filter by folder first
    if (folder !== "all") {
      emails = emails.filter((e) => e.source_folder === folder);
    }

    // Then filter by classification
    if (filter === "needs_review") {
      emails = emails.filter((e) => e.needs_human_review);
    } else if (filter !== "all") {
      emails = emails.filter((e) => e.classification === filter);
    }

    if (searchQuery) {
      emails = emails.filter((e) => matchesSearch(e, searchQuery));
    }

    return emails;
  }, [initialEmails, folder, filter, searchQuery]);

  const selectedEmail = useMemo(() => {
    if (!selectedId) return null;
    return filteredEmails.find((e) => e.id === selectedId) || null;
  }, [filteredEmails, selectedId]);

  const navigateWithParams = useCallback(
    (params: URLSearchParams) => {
      router.push(`/inbox?${params.toString()}`, { scroll: false });
    },
    [router]
  );

  const setFolder = useCallback(
    (newFolder: FolderType) => {
      setFolderState(newFolder);
      const folderValue = newFolder === "all" ? null : newFolder;
      const params = updateUrlParam(searchParams, "folder", folderValue);
      navigateWithParams(params);
    },
    [searchParams, navigateWithParams]
  );

  const setFilter = useCallback(
    (newFilter: FilterType) => {
      setFilterState(newFilter);
      const filterValue = newFilter === "all" ? null : newFilter;
      const params = updateUrlParam(searchParams, "filter", filterValue);
      navigateWithParams(params);
    },
    [searchParams, navigateWithParams]
  );

  const selectEmail = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      const params = updateUrlParam(searchParams, "selected", id);
      navigateWithParams(params);
    },
    [searchParams, navigateWithParams]
  );

  const selectNextEmail = useCallback(() => {
    if (filteredEmails.length === 0) return;

    const currentIndex = selectedId
      ? filteredEmails.findIndex((e) => e.id === selectedId)
      : -1;
    const nextIndex = Math.min(currentIndex + 1, filteredEmails.length - 1);
    selectEmail(filteredEmails[nextIndex].id);
  }, [filteredEmails, selectedId, selectEmail]);

  const selectPreviousEmail = useCallback(() => {
    if (filteredEmails.length === 0) return;

    const currentIndex = selectedId
      ? filteredEmails.findIndex((e) => e.id === selectedId)
      : filteredEmails.length;
    const prevIndex = Math.max(currentIndex - 1, 0);
    selectEmail(filteredEmails[prevIndex].id);
  }, [filteredEmails, selectedId, selectEmail]);

  return {
    emails: filteredEmails,
    selectedEmail,
    folder,
    filter,
    searchQuery,
    counts,
    folderCounts,
    setFolder,
    setFilter,
    setSearchQuery,
    selectEmail,
    selectNextEmail,
    selectPreviousEmail,
  };
}
