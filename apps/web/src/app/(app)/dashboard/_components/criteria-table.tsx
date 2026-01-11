"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface CriteriaRow {
  id: string;
  name: string;
  criteria_json: {
    capital?: string;
    property_types?: string[];
    markets?: string[];
    propertyTypes?: { name: string }[];
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

function getStatusVariant(status: string): "default" | "secondary" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "draft":
      return "secondary";
    default:
      return "outline";
  }
}

function parsePropertyTypes(criteria: CriteriaRow["criteria_json"]): string {
  if (!criteria) return "-";

  // Handle array of objects with name property
  if (criteria.propertyTypes) {
    return criteria.propertyTypes.map((pt) => pt.name).join(", ");
  }

  // Handle simple string array
  if (criteria.property_types) {
    return criteria.property_types.join(", ");
  }

  return "-";
}

function parseMarkets(criteria: CriteriaRow["criteria_json"]): string {
  if (!criteria?.markets) return "-";

  // Handle array of objects or strings
  if (Array.isArray(criteria.markets)) {
    return criteria.markets
      .map((m) => (typeof m === "string" ? m : (m as { name?: string }).name || m))
      .slice(0, 3)
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
          Click &quot;New&quot; to create your first sourcing criteria
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
          {data.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">
                {Array.isArray(row.clients)
                  ? row.clients[0]?.name || "-"
                  : row.clients?.name || "-"}
              </TableCell>
              <TableCell>{row.name}</TableCell>
              <TableCell className="max-w-[150px] truncate">
                {parseMarkets(row.criteria_json)}
              </TableCell>
              <TableCell className="max-w-[150px] truncate">
                {parsePropertyTypes(row.criteria_json)}
              </TableCell>
              <TableCell>
                <Badge variant={getStatusVariant(row.status)}>
                  {row.status}
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
