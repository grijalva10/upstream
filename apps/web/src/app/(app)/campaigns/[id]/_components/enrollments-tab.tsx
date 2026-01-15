"use client";

import { useEffect, useState } from "react";
import { Users, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PaginatedEnrollments, EnrollmentWithRelations } from "../../_lib/types";
import { EnrollmentStatusBadge, getEnrollmentStepLabel, formatDateTime } from "../../_lib/utils";

interface EnrollmentsTabProps {
  campaignId: string;
}

export function EnrollmentsTab({ campaignId }: EnrollmentsTabProps) {
  const [data, setData] = useState<PaginatedEnrollments | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function fetchEnrollments() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: "10" });
        if (status !== "all") {
          params.set("status", status);
        }

        const res = await fetch(`/api/campaigns/${campaignId}/enrollments?${params}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (error) {
        console.error("Failed to fetch enrollments:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchEnrollments();
  }, [campaignId, status, page]);

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    setPage(1);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" aria-hidden="true" />
            Enrollments
            {data && (
              <span className="text-sm font-normal text-muted-foreground">
                ({data.total} total)
              </span>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <StatusFilter value={status} onChange={handleStatusChange} />

        {loading ? (
          <LoadingState />
        ) : data && data.data.length > 0 ? (
          <>
            <EnrollmentsList enrollments={data.data} />
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              onPageChange={setPage}
            />
          </>
        ) : (
          <EmptyState status={status} />
        )}
      </CardContent>
    </Card>
  );
}

function StatusFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Tabs value={value} onValueChange={onChange}>
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="all" className="text-xs sm:text-sm">All</TabsTrigger>
        <TabsTrigger value="active" className="text-xs sm:text-sm">Active</TabsTrigger>
        <TabsTrigger value="replied" className="text-xs sm:text-sm">Replied</TabsTrigger>
        <TabsTrigger value="completed" className="text-xs sm:text-sm">Completed</TabsTrigger>
        <TabsTrigger value="stopped" className="text-xs sm:text-sm">Stopped</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-3 border rounded-lg animate-pulse">
          <div className="h-4 bg-muted rounded w-1/3 mb-2" />
          <div className="h-3 bg-muted rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ status }: { status: string }) {
  const message =
    status === "all"
      ? "No enrollments yet"
      : `No ${status} enrollments`;

  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Users className="h-8 w-8 text-muted-foreground/50 mb-2" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function EnrollmentsList({ enrollments }: { enrollments: EnrollmentWithRelations[] }) {
  return (
    <div className="space-y-2">
      {enrollments.map((enrollment) => (
        <EnrollmentRow key={enrollment.id} enrollment={enrollment} />
      ))}
    </div>
  );
}

function EnrollmentRow({ enrollment }: { enrollment: EnrollmentWithRelations }) {
  const contact = enrollment.contact;
  const property = enrollment.property;

  const contactName = contact
    ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || contact.email
    : "Unknown contact";

  const propertyAddress = property
    ? `${property.address ?? ""}, ${property.city ?? ""}, ${property.state ?? ""}`.replace(/, ,/g, ",").replace(/^, |, $/g, "")
    : "Unknown property";

  return (
    <div className="p-3 border rounded-lg hover:bg-muted/30 transition-colors">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{contactName}</p>
          <p className="text-xs text-muted-foreground truncate">{propertyAddress}</p>
        </div>
        <div className="flex items-center gap-3 text-xs sm:text-sm">
          <EnrollmentStatusBadge status={enrollment.status} />
          <span className="text-muted-foreground">
            Step {getEnrollmentStepLabel(enrollment.current_step)}
          </span>
        </div>
      </div>
      {enrollment.stopped_reason && (
        <p className="text-xs text-muted-foreground mt-1">
          Stopped: {enrollment.stopped_reason}
        </p>
      )}
      {enrollment.replied_at && (
        <p className="text-xs text-green-600 mt-1">
          Replied: {formatDateTime(enrollment.replied_at)}
        </p>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
      >
        <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" />
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
      >
        Next
        <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
      </Button>
    </div>
  );
}
