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
        <Button variant="ghost" className="h-auto p-0 text-lg font-semibold hover:bg-transparent">
          {viewLabels[currentView]}
          <span className="ml-1.5 text-sm font-normal text-muted-foreground">
            {counts[currentView]}
          </span>
          <ChevronDown className="ml-1 h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {(Object.keys(viewLabels) as TaskView[]).map((view) => (
          <DropdownMenuItem
            key={view}
            onClick={() => handleViewChange(view)}
            className="flex items-center justify-between"
          >
            <span>{viewLabels[view]}</span>
            <span className="ml-4 text-xs text-muted-foreground">
              {counts[view]}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
