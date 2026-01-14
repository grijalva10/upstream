"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, CheckCircle, AlertCircle, Play } from "lucide-react";

interface CriteriaRow {
  id: string;
  name: string;
  criteria_json: {
    capital?: string;
    property_types?: string[];
    markets?: string[];
    propertyTypes?: { name: string }[] | string[];
    criteria?: {
      markets?: string[];
      propertyTypes?: string[];
    };
  } | null;
  status: string;
  total_properties: number | null;
  total_contacts: number | null;
  created_at: string;
  clients: {
    id: string;
    name: string;
  } | { id: string; name: string }[];
}

interface CriteriaTableProps {
  data: CriteriaRow[];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusConfig(status: string): {
  variant: "default" | "secondary" | "outline" | "destructive";
  label: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case "pending_queries":
      return {
        variant: "secondary",
        label: "Generating...",
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
      };
    case "pending_approval":
      return {
        variant: "default",
        label: "Needs Review",
        icon: <AlertCircle className="h-3 w-3" />,
      };
    case "approved":
      return {
        variant: "outline",
        label: "Approved",
        icon: <CheckCircle className="h-3 w-3" />,
      };
    case "active":
      return {
        variant: "default",
        label: "Active",
        icon: <Play className="h-3 w-3" />,
      };
    case "draft":
      return {
        variant: "secondary",
        label: "Draft",
        icon: <Clock className="h-3 w-3" />,
      };
    default:
      return {
        variant: "outline",
        label: status,
        icon: null,
      };
  }
}

function parsePropertyTypes(criteria: CriteriaRow["criteria_json"]): string {
  if (!criteria) return "-";

  // Check nested criteria object first
  if (criteria.criteria?.propertyTypes) {
    const types = criteria.criteria.propertyTypes;
    if (Array.isArray(types)) {
      return types
        .map((t) => (typeof t === "string" ? t : (t as { name?: string }).name || t))
        .slice(0, 3)
        .join(", ");
    }
  }

  // Handle array of objects with name property
  if (criteria.propertyTypes) {
    const types = criteria.propertyTypes;
    if (Array.isArray(types)) {
      return types
        .map((t) => (typeof t === "string" ? t : (t as { name?: string }).name || t))
        .slice(0, 3)
        .join(", ");
    }
  }

  // Handle simple string array
  if (criteria.property_types) {
    return criteria.property_types.slice(0, 3).join(", ");
  }

  return "-";
}

function parseMarkets(criteria: CriteriaRow["criteria_json"]): string {
  if (!criteria) return "-";

  // Check nested criteria object first
  if (criteria.criteria?.markets) {
    const markets = criteria.criteria.markets;
    if (Array.isArray(markets)) {
      return markets
        .map((m) => (typeof m === "string" ? m : (m as { name?: string }).name || m))
        .slice(0, 2)
        .join(", ");
    }
  }

  if (!criteria.markets) return "-";

  // Handle array of objects or strings
  if (Array.isArray(criteria.markets)) {
    return criteria.markets
      .map((m) => (typeof m === "string" ? m : (m as { name?: string }).name || m))
      .slice(0, 2)
      .join(", ");
  }

  return "-";
}

export function CriteriaTable({ data }: CriteriaTableProps) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground mb-2">No criteria found</p>
        <p className="text-sm text-muted-foreground">
          Click &quot;New Criteria&quot; to create your first sourcing criteria
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Buyer</TableHead>
            <TableHead>Criteria Name</TableHead>
            <TableHead>Markets</TableHead>
            <TableHead>Property Types</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Properties</TableHead>
            <TableHead className="text-right">Contacts</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => {
            const statusConfig = getStatusConfig(row.status);
            return (
              <TableRow
                key={row.id}
                className="cursor-pointer hover:bg-muted/50"
              >
                <TableCell className="font-medium">
                  <Link
                    href={`/clients/criteria/${row.id}`}
                    className="hover:underline"
                  >
                    {Array.isArray(row.clients)
                      ? row.clients[0]?.name || "-"
                      : row.clients?.name || "-"}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/clients/criteria/${row.id}`}
                    className="hover:underline"
                  >
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[150px] truncate">
                  {parseMarkets(row.criteria_json)}
                </TableCell>
                <TableCell className="max-w-[150px] truncate">
                  {parsePropertyTypes(row.criteria_json)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={statusConfig.variant}
                    className="flex items-center gap-1 w-fit"
                  >
                    {statusConfig.icon}
                    {statusConfig.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {row.total_properties || 0}
                </TableCell>
                <TableCell className="text-right">
                  {row.total_contacts || 0}
                </TableCell>
                <TableCell>{formatDate(row.created_at)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
