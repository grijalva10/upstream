import { Loader2, CheckCircle, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SearchStatus, SearchSource, CriteriaJson, ParsedCriteria } from "./types";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

export interface StatusConfig {
  label: string;
  variant: BadgeVariant;
  isLoading: boolean;
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  draft: {
    label: "Draft",
    variant: "outline",
    isLoading: false,
  },
  pending_queries: {
    label: "Pending",
    variant: "secondary",
    isLoading: false,
  },
  generating_queries: {
    label: "Generating...",
    variant: "secondary",
    isLoading: true,
  },
  pending_extraction: {
    label: "Queries Ready",
    variant: "outline",
    isLoading: false,
  },
  extracting: {
    label: "Extracting...",
    variant: "secondary",
    isLoading: true,
  },
  ready: {
    label: "Ready",
    variant: "default",
    isLoading: false,
  },
  campaign_created: {
    label: "Has Campaign",
    variant: "outline",
    isLoading: false,
  },
  failed: {
    label: "Failed",
    variant: "destructive",
    isLoading: false,
  },
};

export const SOURCE_LABELS: Record<SearchSource, string> = {
  "lee-1031-x": "Lee 1031-X",
  manual: "Manual",
  inbound: "Inbound",
};

export function getStatusConfig(status: string): StatusConfig {
  return (
    STATUS_CONFIG[status as SearchStatus] ?? {
      label: status,
      variant: "secondary",
      isLoading: false,
    }
  );
}

export function getSourceLabel(source: string): string {
  return SOURCE_LABELS[source as SearchSource] ?? source;
}

// --- Status Badge Component ---

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "default";
  className?: string;
}

export function StatusBadge({ status, size = "default", className }: StatusBadgeProps) {
  const config = getStatusConfig(status);
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  const icon = config.isLoading ? (
    <Loader2 className={`${iconSize} animate-spin`} aria-hidden="true" />
  ) : status === "ready" ? (
    <CheckCircle className={iconSize} aria-hidden="true" />
  ) : status === "campaign_created" ? (
    <Send className={iconSize} aria-hidden="true" />
  ) : null;

  return (
    <Badge
      variant={config.variant}
      className={`gap-1 ${size === "default" ? "px-3 py-1.5" : ""} ${className ?? ""}`}
    >
      {icon}
      <span>{config.label}</span>
      <span className="sr-only">Status: {config.label}</span>
    </Badge>
  );
}

// --- Criteria Parsing ---

export function parseCriteria(json: CriteriaJson): ParsedCriteria {
  const c = json.criteria ?? json;

  return {
    markets: (c.markets ?? c.targetMarkets ?? []) as string[],
    propertyTypes: (c.propertyTypes ?? c.property_types ?? []) as string[],
    priceRange: c.priceRange ?? null,
    capRate: c.capRate ?? null,
    sqft: c.sqft ?? null,
    strategy: (c.strategy as string) ?? null,
    deadline: (c.deadline as string) ?? null,
    notes: (c.notes as string) ?? null,
  };
}

// --- Formatting ---

export function formatCurrency(value: number | undefined): string {
  if (!value) return "";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

export function formatPriceRange(range: { min?: number; max?: number } | null): string {
  if (!range) return "";
  const min = formatCurrency(range.min);
  const max = formatCurrency(range.max);
  if (min && max) return `${min} - ${max}`;
  if (min) return `>${min}`;
  if (max) return `<${max}`;
  return "";
}

export function formatPercent(value: number | undefined): string {
  if (!value) return "";
  return `${(value * 100).toFixed(1)}%`;
}

export function formatPercentRange(range: { min?: number; max?: number } | null): string {
  if (!range) return "";
  const min = formatPercent(range.min);
  const max = formatPercent(range.max);
  if (min && max) return `${min} - ${max}`;
  if (min) return `>${min}`;
  if (max) return `<${max}`;
  return "";
}

export function getCriteriaSummary(json: CriteriaJson): string {
  const criteria = parseCriteria(json);
  const parts: string[] = [];

  if (criteria.markets.length > 0) {
    const display = criteria.markets.slice(0, 2).join(", ");
    const more = criteria.markets.length > 2 ? ` +${criteria.markets.length - 2}` : "";
    parts.push(display + more);
  }

  if (criteria.propertyTypes.length > 0) {
    parts.push(criteria.propertyTypes.slice(0, 2).join(", "));
  }

  const priceStr = formatPriceRange(criteria.priceRange);
  if (priceStr) parts.push(priceStr);

  return parts.length > 0 ? parts.join(" · ") : "No criteria details";
}

// --- Status Helpers ---

export function isProcessing(status: string): boolean {
  return status === "generating_queries" || status === "extracting";
}

export function canCreateCampaign(status: string): boolean {
  return status === "ready" || status === "campaign_created";
}
