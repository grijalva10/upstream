"use client";

import { cn } from "@/lib/utils";

interface Service {
  name: string;
  lastActive: Date | null;
  status: "healthy" | "warning" | "error";
  detail: string;
}

interface ServicesBarProps {
  services: Service[];
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return "never";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "1d ago";
  return `${diffDays}d ago`;
}

const statusColors: Record<string, string> = {
  healthy: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
};

export function ServicesBar({ services }: ServicesBarProps) {
  return (
    <div className="flex items-center justify-between gap-8 py-3 px-4 border-t border-border/50 bg-muted/20">
      {services.map((service) => (
        <div key={service.name} className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-medium">{service.name}</span>
            <div className={cn("w-1.5 h-1.5 rounded-full", statusColors[service.status])} />
            <span className="text-xs font-mono text-muted-foreground">
              {formatRelativeTime(service.lastActive)}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground/70 font-mono truncate">
            {service.detail}
          </div>
        </div>
      ))}
    </div>
  );
}
