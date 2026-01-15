import { Loader2, CheckCircle, Pause, FileEdit, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CampaignStatus, EnrollmentStatus, CampaignRow, CampaignMetrics, CampaignEmail } from "./types";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

// --- Campaign Status Config ---

export interface StatusConfig {
  label: string;
  variant: BadgeVariant;
  icon: typeof CheckCircle | typeof Loader2 | typeof Pause | typeof FileEdit | null;
  isLoading?: boolean;
}

export const CAMPAIGN_STATUS_CONFIG: Record<CampaignStatus, StatusConfig> = {
  draft: {
    label: "Draft",
    variant: "secondary",
    icon: FileEdit,
  },
  active: {
    label: "Active",
    variant: "default",
    icon: Loader2,
    isLoading: true,
  },
  paused: {
    label: "Paused",
    variant: "outline",
    icon: Pause,
  },
  completed: {
    label: "Completed",
    variant: "secondary",
    icon: CheckCircle,
  },
};

export function getCampaignStatusConfig(status: string): StatusConfig {
  return (
    CAMPAIGN_STATUS_CONFIG[status as CampaignStatus] ?? {
      label: status,
      variant: "secondary",
      icon: null,
    }
  );
}

// --- Enrollment Status Config ---

export interface EnrollmentStatusConfig {
  label: string;
  color: string;
  dotColor: string;
}

export const ENROLLMENT_STATUS_CONFIG: Record<EnrollmentStatus, EnrollmentStatusConfig> = {
  pending: {
    label: "Pending",
    color: "text-muted-foreground",
    dotColor: "bg-gray-400",
  },
  active: {
    label: "Active",
    color: "text-blue-600",
    dotColor: "bg-blue-500",
  },
  replied: {
    label: "Replied",
    color: "text-green-600",
    dotColor: "bg-green-500",
  },
  completed: {
    label: "Completed",
    color: "text-muted-foreground",
    dotColor: "bg-gray-500",
  },
  stopped: {
    label: "Stopped",
    color: "text-red-600",
    dotColor: "bg-red-500",
  },
};

export function getEnrollmentStatusConfig(status: string): EnrollmentStatusConfig {
  return (
    ENROLLMENT_STATUS_CONFIG[status as EnrollmentStatus] ?? {
      label: status,
      color: "text-muted-foreground",
      dotColor: "bg-gray-400",
    }
  );
}

// --- Campaign Status Badge ---

interface CampaignStatusBadgeProps {
  status: string;
  size?: "sm" | "default";
  className?: string;
}

export function CampaignStatusBadge({ status, size = "default", className }: CampaignStatusBadgeProps) {
  const config = getCampaignStatusConfig(status);
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={`gap-1 ${size === "default" ? "px-3 py-1.5" : ""} ${className ?? ""}`}
    >
      {Icon && (
        <Icon
          className={`${iconSize} ${config.isLoading ? "animate-spin" : ""}`}
          aria-hidden="true"
        />
      )}
      <span>{config.label}</span>
      <span className="sr-only">Status: {config.label}</span>
    </Badge>
  );
}

// --- Enrollment Status Badge ---

interface EnrollmentStatusBadgeProps {
  status: string;
  className?: string;
}

export function EnrollmentStatusBadge({ status, className }: EnrollmentStatusBadgeProps) {
  const config = getEnrollmentStatusConfig(status);

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs sm:text-sm ${config.color} ${className ?? ""}`}>
      <Circle className={`h-2 w-2 fill-current ${config.dotColor}`} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}

// --- Metrics Calculation ---

export function calculateMetrics(campaign: CampaignRow): CampaignMetrics {
  const enrolled = campaign.total_enrolled ?? 0;
  const sent = campaign.total_sent ?? 0;
  const opened = campaign.total_opened ?? 0;
  const replied = campaign.total_replied ?? 0;
  const stopped = campaign.total_stopped ?? 0;

  return {
    enrolled,
    sent,
    sentRate: enrolled > 0 ? (sent / enrolled) * 100 : 0,
    opened,
    openRate: sent > 0 ? (opened / sent) * 100 : 0,
    replied,
    replyRate: sent > 0 ? (replied / sent) * 100 : 0,
    stopped,
    stopRate: enrolled > 0 ? (stopped / enrolled) * 100 : 0,
  };
}

// --- Formatting ---

export function formatRate(value: number): string {
  if (value === 0) return "0%";
  if (value < 1) return `${value.toFixed(1)}%`;
  return `${Math.round(value)}%`;
}

export function formatDateTime(dateString: string | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleString();
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString();
}

export function formatTime(timeString: string | null): string {
  if (!timeString) return "—";
  // timeString is in format "HH:MM:SS"
  const [hours, minutes] = timeString.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

// --- Email Helpers ---

export function getCampaignEmails(campaign: CampaignRow): CampaignEmail[] {
  return [
    {
      number: 1,
      subject: campaign.email_1_subject,
      body: campaign.email_1_body,
      delayDays: 0,
    },
    {
      number: 2,
      subject: campaign.email_2_subject,
      body: campaign.email_2_body,
      delayDays: campaign.email_2_delay_days,
    },
    {
      number: 3,
      subject: campaign.email_3_subject,
      body: campaign.email_3_body,
      delayDays: campaign.email_3_delay_days,
    },
  ];
}

// --- Status Helpers ---

export function isActive(status: string): boolean {
  return status === "active";
}

export function canPause(status: string): boolean {
  return status === "active";
}

export function canResume(status: string): boolean {
  return status === "paused";
}

export function canEdit(status: string): boolean {
  return status === "draft" || status === "paused";
}

export function getEnrollmentStepLabel(step: number | null): string {
  if (step === null || step === 0) return "—";
  return `${step}/3`;
}
