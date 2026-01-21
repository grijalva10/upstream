import { cn } from "@/lib/utils";

type StatusDotSize = "sm" | "default";

interface StatusDotProps {
  status: string;
  label?: string;
  showLabel?: boolean;
  size?: StatusDotSize;
  className?: string;
}

const statusConfig: Record<string, { dot: string; color: string }> = {
  // Success/Active states
  active: { dot: "●", color: "text-emerald-500" },
  healthy: { dot: "●", color: "text-emerald-500" },
  completed: { dot: "✓", color: "text-emerald-500" },
  qualified: { dot: "●", color: "text-emerald-500" },
  handed_off: { dot: "✓", color: "text-purple-500" },
  sent: { dot: "✓", color: "text-emerald-500" },

  // Warning/Attention states
  paused: { dot: "○", color: "text-amber-500" },
  warning: { dot: "○", color: "text-amber-500" },
  snoozed: { dot: "○", color: "text-amber-500" },
  hot: { dot: "●", color: "text-amber-500" },
  engaged: { dot: "●", color: "text-amber-500" },
  waiting: { dot: "○", color: "text-amber-500" },
  nurture: { dot: "○", color: "text-amber-500" },

  // Error/Closed states
  error: { dot: "●", color: "text-red-500" },
  failed: { dot: "●", color: "text-red-500" },
  closed: { dot: "●", color: "text-red-500" },
  bounced: { dot: "●", color: "text-red-500" },
  dnc: { dot: "●", color: "text-red-500" },
  rejected: { dot: "●", color: "text-red-500" },
  cancelled: { dot: "●", color: "text-red-500" },

  // Neutral/Pending states
  draft: { dot: "◐", color: "text-zinc-500" },
  new: { dot: "●", color: "text-zinc-500" },
  idle: { dot: "○", color: "text-zinc-500" },
  pending: { dot: "○", color: "text-zinc-500" },
  contacted: { dot: "●", color: "text-blue-500" },
  replied: { dot: "●", color: "text-blue-500" },
  question: { dot: "●", color: "text-blue-500" },

  // Scheduled/Time states
  scheduled: { dot: "◷", color: "text-blue-500" },

  // Search/Campaign specific
  ready: { dot: "●", color: "text-emerald-500" },
  queries_ready: { dot: "●", color: "text-blue-500" },
  extracting: { dot: "◐", color: "text-blue-500" },
  extracted: { dot: "●", color: "text-emerald-500" },
  campaign_active: { dot: "●", color: "text-emerald-500" },
  campaign_created: { dot: "●", color: "text-blue-500" },
  complete: { dot: "✓", color: "text-zinc-600" },
};

const defaultConfig = { dot: "●", color: "text-zinc-500" };

export function StatusDot({
  status,
  label,
  showLabel = false,
  size = "default",
  className,
}: StatusDotProps) {
  const config = statusConfig[status] || defaultConfig;
  const displayLabel = label ?? (showLabel ? status.replace(/_/g, " ") : null);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        size === "sm" ? "text-[10px]" : "text-xs",
        className
      )}
    >
      <span className={cn("flex-shrink-0", config.color)}>{config.dot}</span>
      {displayLabel && (
        <span className={cn("text-muted-foreground", config.color)}>
          {displayLabel}
        </span>
      )}
    </span>
  );
}
