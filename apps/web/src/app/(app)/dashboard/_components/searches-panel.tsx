"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface Search {
  id: string;
  name: string;
  status: string;
  propertyCount: number | null;
}

interface SearchesPanelProps {
  searches: Search[];
  totalCount: number;
}

const statusConfig: Record<string, { label: string; color: string; pulse?: boolean }> = {
  new: { label: "new", color: "text-zinc-500" },
  queries_ready: { label: "ready", color: "text-zinc-400" },
  extracting: { label: "extractng", color: "text-amber-500", pulse: true },
  extracted: { label: "extracted", color: "text-foreground" },
  campaign_active: { label: "campaign", color: "text-emerald-500" },
  complete: { label: "complete", color: "text-zinc-600" },
};

export function SearchesPanel({ searches, totalCount }: SearchesPanelProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Searches
        </h2>
        <span className="text-xs font-mono text-muted-foreground">{totalCount}</span>
      </div>

      {searches.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm text-muted-foreground">No active searches</span>
        </div>
      ) : (
        <div className="space-y-0.5">
          {searches.map((search) => {
            const config = statusConfig[search.status] || statusConfig.new;

            return (
              <Link
                key={search.id}
                href={`/searches/${search.id}`}
                className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded hover:bg-muted/50 transition-colors group"
              >
                <span className="text-xs flex-1 truncate text-muted-foreground group-hover:text-foreground">
                  {search.name}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-mono w-16 text-right",
                    config.color,
                    config.pulse && "animate-pulse"
                  )}
                >
                  {config.label}
                </span>
                <span className="text-xs font-mono text-muted-foreground/60 w-10 text-right">
                  {search.status === "extracting"
                    ? "..."
                    : search.propertyCount != null
                      ? search.propertyCount
                      : "—"}
                </span>
              </Link>
            );
          })}

          {totalCount > searches.length && (
            <Link
              href="/searches"
              className="block text-xs text-muted-foreground hover:text-foreground py-1 text-center"
            >
              View all →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
