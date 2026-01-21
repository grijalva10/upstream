"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface AttentionItem {
  label: string;
  count: number;
  href: string;
  urgent: boolean;
}

interface AttentionPanelProps {
  items: AttentionItem[];
}

export function AttentionPanel({ items }: AttentionPanelProps) {
  const totalCount = items.reduce((sum, item) => sum + item.count, 0);
  const visibleItems = items.filter((item) => item.count > 0);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Attention
        </h2>
        {totalCount > 0 && (
          <span className="text-xs font-mono text-muted-foreground">
            {totalCount}
          </span>
        )}
      </div>

      {visibleItems.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm text-emerald-500 font-mono">✓ All clear</span>
        </div>
      ) : (
        <div className="space-y-1">
          {visibleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded hover:bg-muted/50 transition-colors group"
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full flex-shrink-0",
                  item.urgent ? "bg-amber-500" : "bg-zinc-500"
                )}
              />
              <span className="text-sm flex-1 truncate group-hover:text-foreground text-muted-foreground">
                {item.count} {item.label}
              </span>
              <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
