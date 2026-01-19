"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
}: PaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push("ellipsis");
      }

      // Show pages around current
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push("ellipsis");
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-sm text-muted-foreground">
        Showing {startItem}-{endItem} of {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          asChild
          disabled={currentPage === 1}
        >
          {currentPage === 1 ? (
            <span className="opacity-50 cursor-not-allowed">
              <ChevronLeft className="h-4 w-4" />
            </span>
          ) : (
            <Link href={`?page=${currentPage - 1}`}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          )}
        </Button>

        {getPageNumbers().map((page, index) =>
          page === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="px-2 text-muted-foreground"
            >
              ...
            </span>
          ) : (
            <Button
              key={page}
              variant={page === currentPage ? "default" : "outline"}
              size="icon-sm"
              asChild={page !== currentPage}
            >
              {page === currentPage ? (
                <span>{page}</span>
              ) : (
                <Link href={`?page=${page}`}>{page}</Link>
              )}
            </Button>
          )
        )}

        <Button
          variant="outline"
          size="icon-sm"
          asChild
          disabled={currentPage === totalPages}
        >
          {currentPage === totalPages ? (
            <span className="opacity-50 cursor-not-allowed">
              <ChevronRight className="h-4 w-4" />
            </span>
          ) : (
            <Link href={`?page=${currentPage + 1}`}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </Button>
      </div>
    </div>
  );
}
