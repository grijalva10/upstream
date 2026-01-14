"use client";

import { useEffect } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { MailSidebar } from "./mail-sidebar";
import { MailList } from "./mail-list";
import { MailDisplay } from "./mail-display";
import { useMail, type Email, type ClassificationCount, type FolderCount } from "./use-mail";

interface MailProps {
  emails: Email[];
  counts: ClassificationCount[];
  folderCounts: FolderCount[];
}

export function Mail({ emails: initialEmails, counts: initialCounts, folderCounts: initialFolderCounts }: MailProps): React.ReactElement {
  const mail = useMail(initialEmails, initialCounts, initialFolderCounts);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input/textarea
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
          mail.selectNextEmail();
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          mail.selectPreviousEmail();
          break;
        case "Escape":
          e.preventDefault();
          mail.selectEmail(null);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mail]);

  return (
    <div className="h-full flex flex-col">
      <ResizablePanelGroup
        orientation="horizontal"
        className="h-full"
      >
        {/* Classification Sidebar */}
        <ResizablePanel
          id="sidebar"
          defaultSize="15%"
          minSize="10%"
          maxSize="25%"
          className="hidden md:block overflow-hidden"
        >
          <MailSidebar
            folder={mail.folder}
            filter={mail.filter}
            counts={mail.counts}
            folderCounts={mail.folderCounts}
            onFolderChange={mail.setFolder}
            onFilterChange={mail.setFilter}
          />
        </ResizablePanel>

        <ResizableHandle withHandle className="hidden md:flex" />

        {/* Email List */}
        <ResizablePanel
          id="list"
          defaultSize="30%"
          minSize="20%"
          maxSize="45%"
          className="overflow-hidden"
        >
          <MailList
            emails={mail.emails}
            selectedId={mail.selectedEmail?.id || null}
            searchQuery={mail.searchQuery}
            onSearchChange={mail.setSearchQuery}
            onSelectEmail={mail.selectEmail}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Email Display */}
        <ResizablePanel
          id="display"
          defaultSize="55%"
          minSize="30%"
          className="overflow-hidden"
        >
          <MailDisplay email={mail.selectedEmail} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
