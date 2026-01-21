"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface JobRun {
  completedAt: Date;
  output: string | null;
}

interface Job {
  name: string;
  displayName: string;
  lastRun: Date | null;
  nextRun: string;
  status: "healthy" | "warning" | "error" | "idle";
  recentRuns: JobRun[];
}

interface JobsPanelProps {
  jobs: Job[];
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return "never";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
}

const statusColors: Record<string, string> = {
  healthy: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  idle: "bg-zinc-500",
};

function JobRow({ job }: { job: Job }) {
  const [open, setOpen] = useState(false);
  const hasHistory = job.recentRuns.length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          "w-full flex items-center gap-2 py-1.5 px-2 -mx-2 rounded transition-colors text-left",
          hasHistory && "hover:bg-muted/50 cursor-pointer",
          !hasHistory && "cursor-default"
        )}
        disabled={!hasHistory}
      >
        <span className="text-xs text-muted-foreground flex-1 truncate">
          {job.displayName}
        </span>
        <span className="text-xs font-mono text-muted-foreground w-16 text-right">
          {formatRelativeTime(job.lastRun)}
        </span>
        <span className="text-xs font-mono text-muted-foreground/60 w-16 text-right hidden md:block">
          {job.nextRun}
        </span>
        <div className="w-4 flex items-center justify-center">
          <div className={cn("w-1.5 h-1.5 rounded-full", statusColors[job.status])} />
        </div>
        {hasHistory && (
          <ChevronDown
            className={cn(
              "h-3 w-3 text-muted-foreground/50 transition-transform",
              open && "rotate-180"
            )}
          />
        )}
      </CollapsibleTrigger>

      {hasHistory && (
        <CollapsibleContent>
          <div className="ml-2 pl-2 border-l border-border/50 mt-1 mb-2 space-y-1">
            {job.recentRuns.slice(0, 3).map((run, idx) => (
              <div key={idx} className="text-[10px] text-muted-foreground/70 font-mono truncate">
                {run.output || "completed"}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

export function JobsPanel({ jobs }: JobsPanelProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Jobs
        </h2>
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground/50 font-mono">
          <span>last</span>
          <span className="hidden md:inline">next</span>
        </div>
      </div>

      <div className="space-y-0.5">
        {jobs.map((job) => (
          <JobRow key={job.name} job={job} />
        ))}
      </div>
    </div>
  );
}
