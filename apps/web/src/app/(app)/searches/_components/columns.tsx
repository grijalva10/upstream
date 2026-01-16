"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Column, Filter } from "@/app/(app)/data/_components/data-table";
import type { SearchWithRelations } from "../_lib/types";
import { StatusBadge, getSourceLabel, getCriteriaSummary, isProcessing } from "../_lib/utils";
import { formatDistanceToNow } from "date-fns";

// Re-export type
export type { SearchWithRelations };

// ============================================================================
// COLUMNS
// ============================================================================

export const searchColumns: Column<SearchWithRelations>[] = [
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    enableSorting: true,
    enableHiding: false,
    cell: (_, row) => (
      <Link
        href={`/searches/${row.id}`}
        className="font-medium text-foreground hover:underline"
      >
        {row.name}
      </Link>
    ),
  },
  {
    id: "criteria",
    header: "Criteria",
    accessorFn: (row) => getCriteriaSummary(row.criteria_json),
    className: "text-muted-foreground max-w-[200px] truncate",
  },
  {
    id: "status",
    header: "Status",
    accessorKey: "status",
    align: "center",
    enableSorting: true,
    cell: (v) => <StatusBadge status={v as string} size="sm" />,
  },
  {
    id: "source",
    header: "Source",
    accessorKey: "source",
    align: "center",
    enableSorting: true,
    cell: (v) => (
      <Badge variant="outline" className="text-xs">
        {getSourceLabel(v as string)}
      </Badge>
    ),
  },
  {
    id: "properties",
    header: "Properties",
    accessorKey: "total_properties",
    align: "right",
    enableSorting: true,
    cell: (v) => (v as number)?.toLocaleString() ?? "0",
  },
  {
    id: "companies",
    header: "Companies",
    accessorKey: "total_companies",
    align: "right",
    enableSorting: true,
    cell: (v) => (v as number)?.toLocaleString() ?? "0",
  },
  {
    id: "contacts",
    header: "Contacts",
    accessorKey: "total_contacts",
    align: "right",
    enableSorting: true,
    cell: (v) => (v as number)?.toLocaleString() ?? "0",
  },
  {
    id: "campaign",
    header: "Campaign",
    align: "center",
    accessorFn: (row) => row.campaigns?.[0]?.status ?? null,
    cell: (_, row) => {
      const campaign = row.campaigns?.[0];
      if (!campaign) return <span className="text-muted-foreground">—</span>;
      return (
        <Badge variant="outline" className="text-xs">
          {campaign.status}
        </Badge>
      );
    },
  },
  {
    id: "created_at",
    header: "Created",
    accessorKey: "created_at",
    align: "right",
    enableSorting: true,
    cell: (v) => {
      if (!v) return "—";
      return formatDistanceToNow(new Date(v as string), { addSuffix: true });
    },
  },
  {
    id: "actions",
    header: "",
    align: "right",
    enableHiding: false,
    enableSorting: false,
    accessorFn: () => null,
    cell: (_, row) => <ActionCell row={row} />,
  },
];

// ============================================================================
// ACTION CELL
// ============================================================================

function ActionCell({ row }: { row: SearchWithRelations }) {
  const processing = isProcessing(row.status);
  const hasCampaign = row.campaigns?.length > 0;
  const campaignId = row.campaigns?.[0]?.id;

  if (processing) {
    return (
      <Button size="sm" variant="ghost" className="h-7 px-2" asChild>
        <Link href={`/searches/${row.id}`}>
          View
          <ArrowRight className="ml-1 h-3 w-3" />
        </Link>
      </Button>
    );
  }

  if (hasCampaign && campaignId) {
    return (
      <Button size="sm" variant="ghost" className="h-7 px-2" asChild>
        <Link href={`/campaigns/${campaignId}`}>
          Campaign
          <ArrowRight className="ml-1 h-3 w-3" />
        </Link>
      </Button>
    );
  }

  if (row.status === "ready") {
    return (
      <Button size="sm" variant="ghost" className="h-7 px-2" asChild>
        <Link href={`/searches/${row.id}`}>
          View
          <ArrowRight className="ml-1 h-3 w-3" />
        </Link>
      </Button>
    );
  }

  return (
    <Button size="sm" variant="ghost" className="h-7 px-2" asChild>
      <Link href={`/searches/${row.id}`}>
        View
        <ArrowRight className="ml-1 h-3 w-3" />
      </Link>
    </Button>
  );
}

// ============================================================================
// FILTERS
// ============================================================================

export const searchFilters: Filter[] = [
  {
    id: "status",
    label: "Status",
    options: [
      { value: "all", label: "All" },
      { value: "draft", label: "Draft" },
      { value: "pending_queries", label: "Pending" },
      { value: "generating_queries", label: "Generating" },
      { value: "extracting", label: "Extracting" },
      { value: "ready", label: "Ready" },
      { value: "campaign_created", label: "Has Campaign" },
      { value: "failed", label: "Failed" },
    ],
  },
  {
    id: "source",
    label: "Source",
    options: [
      { value: "all", label: "All" },
      { value: "lee-1031-x", label: "Lee 1031-X" },
      { value: "manual", label: "Manual" },
      { value: "inbound", label: "Inbound" },
    ],
  },
];
