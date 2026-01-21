"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { List, Mail, Phone, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export type TaskType = "all" | "email" | "call" | "task";

const tabs: { id: TaskType; label: string; icon: typeof List }[] = [
  { id: "all", label: "All", icon: List },
  { id: "email", label: "Emails", icon: Mail },
  { id: "call", label: "Calls", icon: Phone },
  { id: "task", label: "Tasks", icon: CheckSquare },
];

export function TaskTabs() {
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") || "inbox";
  const currentType = (searchParams.get("type") as TaskType) || "all";

  const buildHref = (type: TaskType) => {
    const params = new URLSearchParams();
    if (currentView !== "inbox") {
      params.set("view", currentView);
    }
    if (type !== "all") {
      params.set("type", type);
    }
    const query = params.toString();
    return query ? `/inbox?${query}` : "/inbox";
  };

  return (
    <div className="flex gap-1 border-b border-border/50 mb-4">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.id}
            href={buildHref(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
              currentType === tab.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
