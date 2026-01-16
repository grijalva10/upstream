"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BreadcrumbItem } from "@/lib/page-context";

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps): ReactNode {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex items-center text-sm text-muted-foreground",
        className
      )}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isLink = item.href && !isLast;

        return (
          <span key={item.label} className="flex items-center">
            {index > 0 && (
              <ChevronRight className="h-3.5 w-3.5 mx-1.5 flex-shrink-0" />
            )}
            {isLink ? (
              <Link
                href={item.href!}
                className="hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn(isLast && "text-foreground font-medium")}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
