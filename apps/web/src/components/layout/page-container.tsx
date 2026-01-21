import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageContainerVariant = "default" | "full-bleed" | "narrow" | "constrained";

interface PageContainerProps {
  children: ReactNode;
  variant?: PageContainerVariant;
  className?: string;
}

const variantStyles: Record<PageContainerVariant, string> = {
  default: "px-4 sm:px-6 py-6",
  "full-bleed": "h-full",
  narrow: "px-4 sm:px-6 py-6 max-w-3xl mx-auto",
  constrained: "px-4 sm:px-6 py-6 max-w-6xl mx-auto",
};

export function PageContainer({
  children,
  variant = "default",
  className,
}: PageContainerProps): ReactNode {
  return (
    <div className={cn(variantStyles[variant], className)}>{children}</div>
  );
}
