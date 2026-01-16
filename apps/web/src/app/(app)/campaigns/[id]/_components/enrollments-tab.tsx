"use client";

import { useEffect, useState } from "react";
import {
  Users,
  ChevronLeft,
  ChevronRight,
  Search,
  Building2,
  Mail,
  CheckCircle2,
  Clock,
  XCircle,
  MessageSquare,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { PaginatedEnrollments, EnrollmentWithRelations } from "../../_lib/types";
import { formatDateTime } from "../../_lib/utils";

interface EnrollmentsTabProps {
  campaignId: string;
}

const STATUS_CONFIG = {
  all: { label: "All", icon: Users, color: "text-foreground" },
  active: { label: "Active", icon: Clock, color: "text-blue-600" },
  replied: { label: "Replied", icon: MessageSquare, color: "text-emerald-600" },
  completed: { label: "Completed", icon: CheckCircle2, color: "text-slate-600" },
  stopped: { label: "Stopped", icon: XCircle, color: "text-red-600" },
};

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
    <div className="space-y-4">
      {/* Header with status filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filter by status:</span>
        </div>
        <StatusFilter value={status} onChange={handleStatusChange} counts={data ? {
          all: data.total,
        } : undefined} />
      </div>

      {/* Results */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Table header */}
        <div className="hidden sm:grid grid-cols-[1fr_1fr_120px_100px] gap-4 px-4 py-3 bg-muted/30 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <div>Contact</div>
          <div>Property</div>
          <div>Progress</div>
          <div className="text-right">Status</div>
        </div>

        {/* Content */}
        {loading ? (
          <LoadingState />
        ) : data && data.data.length > 0 ? (
          <div className="divide-y">
            {data.data.map((enrollment) => (
              <EnrollmentRow key={enrollment.id} enrollment={enrollment} />
            ))}
          </div>
        ) : (
          <EmptyState status={status} />
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

function StatusFilter({
  value,
  onChange,
  counts,
}: {
  value: string;
  onChange: (v: string) => void;
  counts?: { all: number };
}) {
  const statuses = ["all", "active", "replied", "completed", "stopped"] as const;

  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((statusKey) => {
        const config = STATUS_CONFIG[statusKey];
        const isActive = value === statusKey;
        const Icon = config.icon;

        return (
          <button
            key={statusKey}
            onClick={() => onChange(statusKey)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {config.label}
            {statusKey === "all" && counts?.all !== undefined && (
              <Badge
                variant={isActive ? "secondary" : "outline"}
                className="h-5 px-1.5 text-xs ml-1"
              >
                {counts.all}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="divide-y">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ status }: { status: string }) {
  const message =
    status === "all"
      ? "No contacts enrolled yet"
      : `No ${STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.label.toLowerCase() ?? status} enrollments`;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-3 rounded-full bg-muted/50 mb-4">
        <Search className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
      <p className="text-xs text-muted-foreground/70 mt-1">
        Enroll contacts from your search results to begin outreach
      </p>
    </div>
  );
}

function EnrollmentRow({ enrollment }: { enrollment: EnrollmentWithRelations }) {
  const contact = enrollment.contact;
  const property = enrollment.property;

  const contactName = contact
    ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "Unknown"
    : "Unknown contact";

  const contactEmail = contact?.email ?? "No email";

  const propertyAddress = property
    ? `${property.address ?? ""}`.trim() || "Unknown property"
    : "Unknown property";

  const propertyLocation = property
    ? `${property.city ?? ""}, ${property.state ?? ""}`.replace(/^, |, $/g, "").trim() || ""
    : "";

  const statusConfig = getStatusConfig(enrollment.status);
  const StatusIcon = statusConfig.icon;
  const progress = enrollment.current_step ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_120px_100px] gap-2 sm:gap-4 p-4 hover:bg-muted/20 transition-colors">
      {/* Contact */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary flex-shrink-0">
          <span className="text-sm font-medium">
            {contactName.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">{contactName}</p>
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
            <Mail className="h-3 w-3" />
            {contactEmail}
          </p>
        </div>
      </div>

      {/* Property */}
      <div className="flex items-center gap-2 sm:gap-3 pl-13 sm:pl-0">
        <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0 hidden sm:block" />
        <div className="min-w-0">
          <p className="text-sm truncate">{propertyAddress}</p>
          {propertyLocation && (
            <p className="text-xs text-muted-foreground truncate">{propertyLocation}</p>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 pl-13 sm:pl-0">
        <div className="flex gap-1">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`h-2 w-6 rounded-full ${
                step <= progress ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {progress}/3
        </span>
      </div>

      {/* Status */}
      <div className="flex items-center justify-start sm:justify-end pl-13 sm:pl-0">
        <span className={`inline-flex items-center gap-1.5 text-sm ${statusConfig.color}`}>
          <StatusIcon className="h-4 w-4" />
          <span className="capitalize">{enrollment.status}</span>
        </span>
      </div>

      {/* Additional info for replied/stopped */}
      {(enrollment.replied_at || enrollment.stopped_reason) && (
        <div className="col-span-full pl-13 sm:pl-0 sm:col-start-2 sm:col-span-3 mt-1">
          {enrollment.replied_at && (
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              Replied {formatDateTime(enrollment.replied_at)}
            </p>
          )}
          {enrollment.stopped_reason && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Stopped: {enrollment.stopped_reason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function getStatusConfig(status: string) {
  switch (status) {
    case "active":
      return { icon: Clock, color: "text-blue-600" };
    case "replied":
      return { icon: MessageSquare, color: "text-emerald-600" };
    case "completed":
      return { icon: CheckCircle2, color: "text-slate-600" };
    case "stopped":
      return { icon: XCircle, color: "text-red-600" };
    default:
      return { icon: Clock, color: "text-muted-foreground" };
  }
}

function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  const start = (page - 1) * 10 + 1;
  const end = Math.min(page * 10, total);

  return (
    <div className="flex items-center justify-between px-1">
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{start}-{end}</span> of{" "}
        <span className="font-medium text-foreground">{total}</span> enrollments
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
        </Button>
        <div className="hidden sm:flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (page <= 3) {
              pageNum = i + 1;
            } else if (page >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = page - 2 + i;
            }

            return (
              <Button
                key={pageNum}
                size="sm"
                variant={page === pageNum ? "default" : "ghost"}
                onClick={() => onPageChange(pageNum)}
                className="w-8 h-8 p-0"
              >
                {pageNum}
              </Button>
            );
          })}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="gap-1"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
