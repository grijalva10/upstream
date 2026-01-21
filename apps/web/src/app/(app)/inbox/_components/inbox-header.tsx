"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type TaskView = "inbox" | "future" | "archive";

const viewLabels: Record<TaskView, string> = {
  inbox: "Inbox",
  future: "Future",
  archive: "Archive",
};

interface InboxHeaderProps {
  counts: {
    inbox: number;
    future: number;
    archive: number;
  };
}

export function InboxHeader({ counts }: InboxHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentView = (searchParams.get("view") as TaskView) || "inbox";
  const currentType = searchParams.get("type") || "all";

  const handleViewChange = (view: TaskView) => {
    const params = new URLSearchParams();
    params.set("view", view);
    if (currentType !== "all") {
      params.set("type", currentType);
    }
    router.push(`/inbox?${params.toString()}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {viewLabels[currentView]}
          </span>
          <span className="ml-2 text-xs font-mono text-muted-foreground">
            {counts[currentView]}
          </span>
          <ChevronDown className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {(Object.keys(viewLabels) as TaskView[]).map((view) => (
          <DropdownMenuItem
            key={view}
            onClick={() => handleViewChange(view)}
            className="flex items-center justify-between"
          >
            <span className="text-xs uppercase tracking-wider">{viewLabels[view]}</span>
            <span className="ml-4 text-xs font-mono text-muted-foreground">
              {counts[view]}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
