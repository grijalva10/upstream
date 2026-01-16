"use client";

import { useState, useMemo } from "react";
import { Users, Mail, Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Enrollment {
  id: string;
  status: string;
  current_step: number | null;
  created_at: string;
  contact: { id: string; name: string | null; email: string | null } | null;
  property: { id: string; address: string | null; city: string | null; state_code: string | null } | null;
}

interface EnrollmentsTableProps {
  enrollments: Enrollment[];
  total: number;
}

const PAGE_SIZE = 20;

export function EnrollmentsTable({ enrollments, total }: EnrollmentsTableProps) {
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(enrollments.length / PAGE_SIZE);

  const paginatedEnrollments = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return enrollments.slice(start, start + PAGE_SIZE);
  }, [enrollments, page]);

  if (enrollments.length === 0) {
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-8 w-8 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">No contacts enrolled yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Click &quot;Enroll Contacts&quot; to add contacts from the search
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Table header */}
        <div className="hidden sm:grid grid-cols-[1fr_1fr_100px_80px] gap-4 px-4 py-3 bg-muted/30 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <div>Contact</div>
          <div>Property</div>
          <div>Progress</div>
          <div className="text-right">Status</div>
        </div>

        {/* Rows */}
        <div className="divide-y">
          {paginatedEnrollments.map((enrollment) => (
            <div
              key={enrollment.id}
              className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_100px_80px] gap-2 sm:gap-4 p-4 hover:bg-muted/20 transition-colors"
            >
              {/* Contact */}
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/10 text-primary flex-shrink-0">
                  <span className="text-sm font-medium">
                    {(enrollment.contact?.name || "?")[0].toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {enrollment.contact?.name || "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {enrollment.contact?.email || "No email"}
                  </p>
                </div>
              </div>

              {/* Property */}
              <div className="flex items-center gap-2 pl-12 sm:pl-0">
                <Building2 className="h-4 w-4 text-muted-foreground hidden sm:block" />
                <div className="min-w-0">
                  <p className="text-sm truncate">
                    {enrollment.property?.address || "Unknown property"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[enrollment.property?.city, enrollment.property?.state_code]
                      .filter(Boolean)
                      .join(", ") || ""}
                  </p>
                </div>
              </div>

              {/* Progress */}
              <div className="flex items-center gap-2 pl-12 sm:pl-0">
                <div className="flex gap-1">
                  {[1, 2, 3].map((step) => (
                    <div
                      key={step}
                      className={`h-2 w-5 rounded-full ${
                        step <= (enrollment.current_step ?? 0)
                          ? "bg-primary"
                          : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {enrollment.current_step ?? 0}/3
                </span>
              </div>

              {/* Status */}
              <div className="flex items-center justify-start sm:justify-end pl-12 sm:pl-0">
                <Badge
                  variant="outline"
                  className={
                    enrollment.status === "replied"
                      ? "text-emerald-600 border-emerald-200"
                      : enrollment.status === "stopped"
                      ? "text-red-600 border-red-200"
                      : ""
                  }
                >
                  {enrollment.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, enrollments.length)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-sm text-muted-foreground tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
