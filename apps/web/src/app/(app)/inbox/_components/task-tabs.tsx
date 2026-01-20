"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type TaskView = "inbox" | "future" | "archive";

interface TaskTabsProps {
  counts: {
    inbox: number;
    future: number;
    archive: number;
  };
}

export function TaskTabs({ counts }: TaskTabsProps) {
  const searchParams = useSearchParams();
  const currentView = (searchParams.get("view") as TaskView) || "inbox";

  const tabs: { id: TaskView; label: string; count: number }[] = [
    { id: "inbox", label: "Inbox", count: counts.inbox },
    { id: "future", label: "Future", count: counts.future },
    { id: "archive", label: "Archive", count: counts.archive },
  ];

  return (
    <div className="flex gap-1 border-b mb-4">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={`/inbox?view=${tab.id}`}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            currentView === tab.id
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
          <span className="ml-2 text-xs text-muted-foreground">
            {tab.count}
          </span>
        </Link>
      ))}
    </div>
  );
}
