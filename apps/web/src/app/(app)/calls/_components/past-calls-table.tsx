"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ExternalLink, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CallStatusBadge, CallOutcomeBadge } from "./call-status-badge";

interface PastCall {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  outcome: string | null;
  notes_md: string | null;
  contact: {
    id: string;
    name: string | null;
    lead?: {
      id: string;
      name: string;
    };
  };
  deal?: {
    id: string;
    display_id?: string;
    property?: {
      id: string;
      address: string;
      city: string;
      state_code: string;
    };
  };
}

interface PastCallsTableProps {
  calls: PastCall[];
}

export function PastCallsTable({ calls }: PastCallsTableProps) {
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const filteredCalls = useMemo(() => {
    if (outcomeFilter === "all") return calls;
    if (outcomeFilter === "none") return calls.filter((c) => !c.outcome);
    return calls.filter((c) => c.outcome === outcomeFilter);
  }, [calls, outcomeFilter]);

  const totalPages = Math.ceil(filteredCalls.length / pageSize);
  const paginatedCalls = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCalls.slice(start, start + pageSize);
  }, [filteredCalls, currentPage]);

  if (calls.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-1">No past calls</h3>
        <p className="text-sm text-muted-foreground">
          Completed calls will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by outcome" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Outcomes</SelectItem>
            <SelectItem value="qualified">Qualified</SelectItem>
            <SelectItem value="needs_followup">Needs Follow-up</SelectItem>
            <SelectItem value="not_interested">Not Interested</SelectItem>
            <SelectItem value="reschedule">Reschedule</SelectItem>
            <SelectItem value="none">No Outcome</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">
          {filteredCalls.length} call{filteredCalls.length !== 1 ? "s" : ""}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Date</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[140px]">Outcome</TableHead>
              <TableHead className="w-[80px]">Duration</TableHead>
              <TableHead className="w-[60px]">Notes</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedCalls.map((call) => (
              <TableRow key={call.id}>
                <TableCell className="font-mono text-sm">
                  {format(parseISO(call.scheduled_at), "MMM d, h:mm a")}
                </TableCell>
                <TableCell className="font-medium">
                  {call.contact.name || "Unknown"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {call.contact.lead?.name || "-"}
                </TableCell>
                <TableCell>
                  <CallStatusBadge status={call.status} />
                </TableCell>
                <TableCell>
                  <CallOutcomeBadge outcome={call.outcome} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {call.duration_minutes} min
                </TableCell>
                <TableCell>
                  {call.notes_md ? (
                    <FileText className="h-4 w-4 text-green-600" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground/30" />
                  )}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/calls/${call.id}`}>
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
