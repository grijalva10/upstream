import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  children: ReactNode;
  className?: string;
}

export function PageHeader({ children, className }: PageHeaderProps): ReactNode {
  return (
    <div
      className={cn(
        "flex items-center justify-between h-12 px-4 sm:px-6 border-b bg-background",
        className
      )}
    >
      {children}
    </div>
  );
}

interface PageHeaderLeftProps {
  children: ReactNode;
  className?: string;
}

export function PageHeaderLeft({ children, className }: PageHeaderLeftProps): ReactNode {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {children}
    </div>
  );
}

interface PageHeaderRightProps {
  children: ReactNode;
  className?: string;
}

export function PageHeaderRight({ children, className }: PageHeaderRightProps): ReactNode {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {children}
    </div>
  );
}
