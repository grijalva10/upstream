"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Column, Filter } from "@/app/(app)/data/_components/data-table";
import { StatusDot } from "@/components/ui/status-dot";
import type { LeadWithRelations } from "../_lib/types";
import { formatDistanceToNow } from "date-fns";

// Re-export type
export type { LeadWithRelations };

// ============================================================================
// COLUMNS - Simplified to 5 essential columns
// ============================================================================

export const leadColumns: Column<LeadWithRelations>[] = [
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    enableSorting: true,
    enableHiding: false,
    cell: (_, row) => (
      <Link
        href={`/leads/${row.id}`}
        className="font-medium text-foreground hover:underline"
      >
        {row.name}
      </Link>
    ),
  },
  {
    id: "status",
    header: "Status",
    accessorKey: "status",
    enableSorting: true,
    cell: (v) => {
      const status = v as string;
      return <StatusDot status={status} showLabel />;
    },
  },
  {
    id: "info",
    header: "Info",
    accessorFn: (row) => row.contacts.length + row.property_count,
    align: "right",
    enableSorting: false,
    cell: (_, row) => {
      const contacts = row.contacts.length;
      const props = row.property_count;
      if (contacts === 0 && props === 0) {
        return <span className="text-muted-foreground">—</span>;
      }
      return (
        <span className="text-sm text-muted-foreground tabular-nums">
          {contacts} contact{contacts !== 1 ? "s" : ""}
          {props > 0 && (
            <span className="text-muted-foreground/60">
              {" · "}
              {props} prop{props !== 1 ? "s" : ""}
            </span>
          )}
        </span>
      );
    },
  },
  {
    id: "last_activity",
    header: "Activity",
    accessorKey: "last_activity_at",
    align: "right",
    enableSorting: true,
    cell: (v) => {
      if (!v) return <span className="text-muted-foreground">—</span>;
      return (
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(v as string), { addSuffix: true })}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: "",
    align: "right",
    enableHiding: false,
    enableSorting: false,
    accessorFn: () => null,
    cell: (_, row) => (
      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
        <Link href={`/leads/${row.id}`}>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    ),
  },
];

// ============================================================================
// FILTERS
// ============================================================================

export const leadFilters: Filter[] = [
  {
    id: "status",
    label: "Status",
    options: [
      { value: "all", label: "All" },
      { value: "new", label: "New" },
      { value: "contacted", label: "Contacted" },
      { value: "replied", label: "Replied" },
      { value: "engaged", label: "Engaged" },
      { value: "waiting", label: "Waiting" },
      { value: "qualified", label: "Qualified" },
      { value: "handed_off", label: "Handed Off" },
      { value: "nurture", label: "Nurture" },
      { value: "closed", label: "Closed" },
    ],
  },
  {
    id: "lead_type",
    label: "Type",
    options: [
      { value: "all", label: "All" },
      { value: "seller", label: "Seller" },
      { value: "buyer", label: "Buyer" },
      { value: "buyer_seller", label: "Buyer/Seller" },
      { value: "broker", label: "Broker" },
      { value: "other", label: "Other" },
    ],
  },
];
