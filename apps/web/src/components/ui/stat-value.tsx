import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatValueProps {
  children: ReactNode;
  muted?: boolean;
  className?: string;
}

export function StatValue({ children, muted = false, className }: StatValueProps) {
  return (
    <span
      className={cn(
        "text-xs font-mono",
        muted ? "text-muted-foreground" : "text-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}
