"use client";

import Link from "next/link";
import { format, isSameDay, parseISO } from "date-fns";
import { Clock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CallStatusBadge } from "./call-status-badge";

interface UpcomingCall {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  contact: {
    id: string;
    name: string | null;
    phone?: string;
    company?: {
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

interface UpcomingCallsTableProps {
  calls: UpcomingCall[];
}

export function UpcomingCallsTable({ calls }: UpcomingCallsTableProps) {
  if (calls.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-1">No upcoming calls</h3>
        <p className="text-sm text-muted-foreground">
          Schedule calls to see them here
        </p>
      </div>
    );
  }

  // Group calls by date
  const groupedCalls: { date: string; calls: UpcomingCall[] }[] = [];
  let currentGroup: { date: string; calls: UpcomingCall[] } | null = null;

  for (const call of calls) {
    const callDate = parseISO(call.scheduled_at);
    if (!currentGroup || !isSameDay(parseISO(currentGroup.date), callDate)) {
      currentGroup = { date: call.scheduled_at, calls: [] };
      groupedCalls.push(currentGroup);
    }
    currentGroup.calls.push(call);
  }

  return (
    <div className="space-y-6">
      {groupedCalls.map((group) => (
        <div key={group.date} className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground px-2">
            {format(parseISO(group.date), "EEEE, MMMM d")}
          </h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Time</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead className="w-[80px]">Duration</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.calls.map((call) => (
                  <TableRow key={call.id}>
                    <TableCell className="font-mono">
                      {format(parseISO(call.scheduled_at), "h:mm a")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {call.contact.name || "Unknown"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {call.contact.company?.name || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {call.deal?.property ? (
                        <span className="truncate max-w-[200px] block">
                          {call.deal.property.address}, {call.deal.property.city}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {call.duration_minutes} min
                    </TableCell>
                    <TableCell>
                      <CallStatusBadge status={call.status} />
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
        </div>
      ))}
    </div>
  );
}
