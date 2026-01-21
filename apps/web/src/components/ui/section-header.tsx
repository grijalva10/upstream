import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  children: ReactNode;
  count?: number;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({
  children,
  count,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {children}
        </h2>
        {count !== undefined && (
          <span className="text-xs font-mono text-muted-foreground">
            {count.toLocaleString()}
          </span>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}
