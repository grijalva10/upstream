"use client";

import { Badge } from "@/components/ui/badge";
import { Column, Filter } from "./data-table";
import type { Contact, Lead, Property, Campaign, Exclusion } from "./types";

// Re-export types for convenience
export type { Contact, Lead, Property, Campaign, Exclusion };

// Alias for backwards compatibility
export type Company = Lead;

// ============================================================================
// SHARED HELPERS
// ============================================================================

/** Displays value or dash placeholder */
function displayValue(v: unknown): string {
  return v ? String(v) : "-";
}

/** Badge with color mapping */
function coloredBadge(value: string, colors: Record<string, string>): React.ReactNode {
  return <Badge className={colors[value]}>{value}</Badge>;
}

/** Buyer/Seller type badges - shared by contacts and companies */
function buyerSellerBadges(isBuyer: boolean | null, isSeller: boolean | null): React.ReactNode {
  if (!isBuyer && !isSeller) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <div className="flex gap-1 justify-center">
      {isBuyer && <Badge variant="outline" className="text-xs">Buyer</Badge>}
      {isSeller && <Badge variant="outline" className="text-xs">Seller</Badge>}
    </div>
  );
}

// ============================================================================
// CONTACTS
// ============================================================================

const contactStatusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  dnc: "bg-red-100 text-red-800",
  bounced: "bg-orange-100 text-orange-800",
  unsubscribed: "bg-gray-100 text-gray-500",
};

export const contactColumns: Column<Contact>[] = [
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    enableSorting: true,
    cell: displayValue,
  },
  {
    id: "lead",
    header: "Lead",
    accessorFn: (row) => row.lead?.name || "-",
    className: "text-muted-foreground",
  },
  {
    id: "title",
    header: "Title",
    accessorKey: "title",
    defaultHidden: true,
    cell: displayValue,
  },
  {
    id: "email",
    header: "Email",
    accessorKey: "email",
    cell: displayValue,
  },
  {
    id: "phone",
    header: "Phone",
    accessorKey: "phone",
    cell: displayValue,
  },
  {
    id: "status",
    header: "Status",
    accessorKey: "status",
    align: "center",
    cell: (v) => coloredBadge(v as string, contactStatusColors),
  },
  {
    id: "type",
    header: "Type",
    align: "center",
    accessorFn: (row) => [row.is_buyer && "Buyer", row.is_seller && "Seller"].filter(Boolean).join(", "),
    cell: (_, row) => buyerSellerBadges(row.is_buyer, row.is_seller),
  },
  {
    id: "decision_maker",
    header: "DM",
    accessorKey: "is_decision_maker",
    align: "center",
    defaultHidden: true,
    cell: (v) => v ? <Badge className="bg-green-100 text-green-800">Yes</Badge> : "-",
  },
  {
    id: "created_at",
    header: "Created",
    accessorKey: "created_at",
    align: "right",
    defaultHidden: true,
    cell: (v) => new Date(v as string).toLocaleDateString(),
  },
];

export const contactFilters: Filter[] = [
  {
    id: "status",
    label: "Status",
    options: [
      { value: "all", label: "All" },
      { value: "active", label: "Active" },
      { value: "dnc", label: "DNC" },
      { value: "bounced", label: "Bounced" },
      { value: "unsubscribed", label: "Unsubscribed" },
    ],
  },
  {
    id: "type",
    label: "Type",
    options: [
      { value: "all", label: "All" },
      { value: "buyer", label: "Buyer" },
      { value: "seller", label: "Seller" },
    ],
  },
];

// ============================================================================
// LEADS
// ============================================================================

const leadStatusColors: Record<string, string> = {
  new: "bg-gray-100 text-gray-800",
  contacted: "bg-blue-100 text-blue-800",
  engaged: "bg-yellow-100 text-yellow-800",
  qualified: "bg-green-100 text-green-800",
  handed_off: "bg-purple-100 text-purple-800",
  dnc: "bg-red-100 text-red-800",
  rejected: "bg-red-100 text-red-800",
};

const qualificationStatusColors: Record<string, string> = {
  new: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  qualified: "bg-green-100 text-green-800",
  disqualified: "bg-red-100 text-red-800",
};

const sourceColors: Record<string, string> = {
  costar: "bg-blue-100 text-blue-800",
  manual: "bg-gray-100 text-gray-800",
  referral: "bg-purple-100 text-purple-800",
};

export const leadColumns: Column<Lead>[] = [
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    enableSorting: true,
    className: "font-medium",
  },
  {
    id: "status",
    header: "Status",
    accessorKey: "status",
    align: "center",
    cell: (v) => coloredBadge(v as string, leadStatusColors),
  },
  {
    id: "qualification_status",
    header: "Qualification",
    accessorKey: "qualification_status",
    align: "center",
    cell: (v) => v ? coloredBadge(v as string, qualificationStatusColors) : "-",
  },
  {
    id: "type",
    header: "Type",
    align: "center",
    accessorFn: (row) => [row.is_buyer && "Buyer", row.is_seller && "Seller"].filter(Boolean).join(", "),
    cell: (_, row) => buyerSellerBadges(row.is_buyer, row.is_seller),
  },
  {
    id: "source",
    header: "Source",
    accessorKey: "source",
    align: "center",
    cell: (v) => v ? coloredBadge(v as string, sourceColors) : "-",
  },
  {
    id: "lead_score",
    header: "Score",
    accessorKey: "lead_score",
    align: "right",
    enableSorting: true,
    cell: (v) => v != null ? String(v) : "-",
  },
  {
    id: "has_broker",
    header: "Broker",
    accessorKey: "has_broker",
    align: "center",
    defaultHidden: true,
    cell: (v) => v ? <Badge className="bg-orange-100 text-orange-800">Yes</Badge> : "-",
  },
  {
    id: "properties",
    header: "Properties",
    accessorKey: "property_count",
    align: "right",
  },
  {
    id: "contacts",
    header: "Contacts",
    accessorKey: "contact_count",
    align: "right",
  },
  {
    id: "notes",
    header: "Notes",
    accessorKey: "notes",
    defaultHidden: true,
    cell: (v) => v ? String(v).slice(0, 50) + (String(v).length > 50 ? "..." : "") : "-",
  },
  {
    id: "created_at",
    header: "Created",
    accessorKey: "created_at",
    align: "right",
    enableSorting: true,
    defaultHidden: true,
    cell: (v) => new Date(v as string).toLocaleDateString(),
  },
];

export const leadFilters: Filter[] = [
  {
    id: "status",
    label: "Status",
    options: [
      { value: "all", label: "All" },
      { value: "new", label: "New" },
      { value: "contacted", label: "Contacted" },
      { value: "engaged", label: "Engaged" },
      { value: "qualified", label: "Qualified" },
      { value: "handed_off", label: "Handed Off" },
      { value: "dnc", label: "DNC" },
      { value: "rejected", label: "Rejected" },
    ],
  },
  {
    id: "qualification_status",
    label: "Qualification",
    options: [
      { value: "all", label: "All" },
      { value: "new", label: "New" },
      { value: "in_progress", label: "In Progress" },
      { value: "qualified", label: "Qualified" },
      { value: "disqualified", label: "Disqualified" },
    ],
  },
  {
    id: "source",
    label: "Source",
    options: [
      { value: "all", label: "All" },
      { value: "costar", label: "CoStar" },
      { value: "manual", label: "Manual" },
      { value: "referral", label: "Referral" },
    ],
  },
  {
    id: "type",
    label: "Type",
    options: [
      { value: "all", label: "All" },
      { value: "buyer", label: "Buyer" },
      { value: "seller", label: "Seller" },
    ],
  },
  {
    id: "has_broker",
    label: "Has Broker",
    options: [
      { value: "all", label: "All" },
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
];

// ============================================================================
// PROPERTIES
// ============================================================================

const propertyTypeColors: Record<string, string> = {
  Industrial: "bg-slate-100 text-slate-800",
  Office: "bg-blue-100 text-blue-800",
  Retail: "bg-purple-100 text-purple-800",
  Multifamily: "bg-green-100 text-green-800",
  Land: "bg-amber-100 text-amber-800",
  Hospitality: "bg-pink-100 text-pink-800",
  Healthcare: "bg-cyan-100 text-cyan-800",
  "Self Storage": "bg-orange-100 text-orange-800",
};

const buildingClassColors: Record<string, string> = {
  A: "bg-green-100 text-green-800",
  B: "bg-blue-100 text-blue-800",
  C: "bg-gray-100 text-gray-600",
};

function formatNumber(n: number | null): string {
  return n?.toLocaleString() ?? "-";
}

function formatAcres(n: number | null): string {
  return n?.toFixed(2) ?? "-";
}

export const propertyColumns: Column<Property>[] = [
  {
    id: "address",
    header: "Address",
    accessorKey: "address",
    enableSorting: true,
    className: "font-medium",
    cell: displayValue,
  },
  {
    id: "location",
    header: "Location",
    accessorFn: (row) => [row.city, row.state].filter(Boolean).join(", ") || "-",
    className: "text-muted-foreground",
  },
  {
    id: "zip",
    header: "ZIP",
    accessorKey: "zip",
    defaultHidden: true,
    cell: displayValue,
  },
  {
    id: "property_type",
    header: "Type",
    accessorKey: "property_type",
    align: "center",
    cell: (v) => v ? coloredBadge(v as string, propertyTypeColors) : "-",
  },
  {
    id: "building_class",
    header: "Class",
    accessorKey: "building_class",
    align: "center",
    cell: (v) => v ? coloredBadge(v as string, buildingClassColors) : "-",
  },
  {
    id: "sqft",
    header: "SqFt",
    accessorKey: "building_size_sqft",
    align: "right",
    cell: (v) => formatNumber(v as number | null),
  },
  {
    id: "lot_size",
    header: "Lot (ac)",
    accessorKey: "lot_size_acres",
    align: "right",
    defaultHidden: true,
    cell: (v) => formatAcres(v as number | null),
  },
  {
    id: "year_built",
    header: "Year",
    accessorKey: "year_built",
    align: "right",
    enableSorting: true,
    cell: displayValue,
  },
  {
    id: "units",
    header: "Units",
    accessorKey: "units",
    align: "right",
    defaultHidden: true,
    cell: displayValue,
  },
  {
    id: "floors",
    header: "Floors",
    accessorKey: "floors",
    align: "right",
    defaultHidden: true,
    cell: displayValue,
  },
  {
    id: "costar_id",
    header: "CoStar ID",
    accessorKey: "costar_property_id",
    defaultHidden: true,
    className: "font-mono text-xs text-muted-foreground",
    cell: displayValue,
  },
];

export const propertyFilters: Filter[] = [
  {
    id: "property_type",
    label: "Type",
    options: [
      { value: "all", label: "All" },
      { value: "Industrial", label: "Industrial" },
      { value: "Office", label: "Office" },
      { value: "Retail", label: "Retail" },
      { value: "Multifamily", label: "Multifamily" },
      { value: "Land", label: "Land" },
      { value: "Hospitality", label: "Hospitality" },
      { value: "Healthcare", label: "Healthcare" },
      { value: "Self Storage", label: "Self Storage" },
    ],
  },
  {
    id: "building_class",
    label: "Class",
    options: [
      { value: "all", label: "All" },
      { value: "A", label: "Class A" },
      { value: "B", label: "Class B" },
      { value: "C", label: "Class C" },
    ],
  },
  {
    id: "size",
    label: "Size",
    options: [
      { value: "all", label: "All" },
      { value: "small", label: "< 10K sqft" },
      { value: "medium", label: "10K - 50K" },
      { value: "large", label: "50K - 100K" },
      { value: "xlarge", label: "> 100K sqft" },
    ],
  },
];

// ============================================================================
// CAMPAIGNS
// ============================================================================

const campaignStatusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  completed: "bg-blue-100 text-blue-800",
};

export const campaignColumns: Column<Campaign>[] = [
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    enableSorting: true,
    className: "font-medium",
  },
  {
    id: "search",
    header: "Search",
    accessorFn: (row) => row.search?.name || "-",
    className: "text-muted-foreground",
  },
  {
    id: "status",
    header: "Status",
    accessorKey: "status",
    align: "center",
    cell: (v) => coloredBadge(v as string, campaignStatusColors),
  },
  {
    id: "enrolled",
    header: "Enrolled",
    accessorKey: "total_enrolled",
    align: "right",
    cell: (v) => formatNumber(v as number | null),
  },
  {
    id: "sent",
    header: "Sent",
    accessorKey: "total_sent",
    align: "right",
    cell: (v) => formatNumber(v as number | null),
  },
  {
    id: "opened",
    header: "Opened",
    accessorKey: "total_opened",
    align: "right",
    defaultHidden: true,
    cell: (v) => formatNumber(v as number | null),
  },
  {
    id: "replied",
    header: "Replied",
    accessorKey: "total_replied",
    align: "right",
    cell: (v) => formatNumber(v as number | null),
  },
  {
    id: "stopped",
    header: "Stopped",
    accessorKey: "total_stopped",
    align: "right",
    defaultHidden: true,
    cell: (v) => formatNumber(v as number | null),
  },
  {
    id: "created_at",
    header: "Created",
    accessorKey: "created_at",
    align: "right",
    enableSorting: true,
    cell: (v) => new Date(v as string).toLocaleDateString(),
  },
  {
    id: "started_at",
    header: "Started",
    accessorKey: "started_at",
    align: "right",
    defaultHidden: true,
    cell: (v) => v ? new Date(v as string).toLocaleDateString() : "-",
  },
];

export const campaignFilters: Filter[] = [
  {
    id: "status",
    label: "Status",
    options: [
      { value: "all", label: "All" },
      { value: "draft", label: "Draft" },
      { value: "active", label: "Active" },
      { value: "paused", label: "Paused" },
      { value: "completed", label: "Completed" },
    ],
  },
];

// ============================================================================
// EXCLUSIONS (uses dnc_entries table)
// ============================================================================

const exclusionReasonColors: Record<string, string> = {
  requested: "bg-red-100 text-red-800",
  bounced: "bg-orange-100 text-orange-800",
  complaint: "bg-yellow-100 text-yellow-800",
  manual: "bg-blue-100 text-blue-800",
};

const exclusionSourceColors: Record<string, string> = {
  email_response: "bg-blue-100 text-blue-800",
  manual: "bg-gray-100 text-gray-800",
  import: "bg-purple-100 text-purple-800",
};

export const exclusionColumns: Column<Exclusion>[] = [
  {
    id: "email",
    header: "Email",
    accessorKey: "email",
    enableSorting: true,
    className: "font-medium",
    cell: displayValue,
  },
  {
    id: "phone",
    header: "Phone",
    accessorKey: "phone",
    defaultHidden: true,
    cell: displayValue,
  },
  {
    id: "company_name",
    header: "Company",
    accessorKey: "company_name",
    defaultHidden: true,
    cell: displayValue,
  },
  {
    id: "reason",
    header: "Reason",
    accessorKey: "reason",
    align: "center",
    cell: (v) => v ? coloredBadge(v as string, exclusionReasonColors) : "-",
  },
  {
    id: "source",
    header: "Source",
    accessorKey: "source",
    align: "center",
    cell: (v) => v ? coloredBadge(v as string, exclusionSourceColors) : "-",
  },
  {
    id: "notes",
    header: "Notes",
    accessorKey: "notes",
    defaultHidden: true,
    cell: (v) => v ? String(v).slice(0, 50) + (String(v).length > 50 ? "..." : "") : "-",
  },
  {
    id: "added_at",
    header: "Added",
    accessorKey: "added_at",
    align: "right",
    enableSorting: true,
    cell: (v) => new Date(v as string).toLocaleDateString(),
  },
];

export const exclusionFilters: Filter[] = [
  {
    id: "reason",
    label: "Reason",
    options: [
      { value: "all", label: "All" },
      { value: "requested", label: "Requested" },
      { value: "bounced", label: "Bounced" },
      { value: "complaint", label: "Complaint" },
      { value: "manual", label: "Manual" },
    ],
  },
  {
    id: "source",
    label: "Source",
    options: [
      { value: "all", label: "All" },
      { value: "email_response", label: "Email Response" },
      { value: "manual", label: "Manual" },
      { value: "import", label: "Import" },
    ],
  },
];
