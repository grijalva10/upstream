"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Phone, Clock, Building2, MapPin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CallStatusBadge } from "./call-status-badge";

interface TodaysCall {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  contact: {
    id: string;
    name: string | null;
    phone?: string;
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

interface TodaysCallsProps {
  calls: TodaysCall[];
}

export function TodaysCalls({ calls }: TodaysCallsProps) {
  if (calls.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <Phone className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-1">No calls scheduled for today</h3>
        <p className="text-sm text-muted-foreground">
          Schedule a call to see it here
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {calls.map((call) => {
        const time = format(new Date(call.scheduled_at), "h:mm a");
        const contactName = call.contact.name || "Unknown";
        const companyName = call.contact.lead?.name;
        const property = call.deal?.property;
        const isUpcoming = new Date(call.scheduled_at) > new Date();

        const getCardStyle = (): string => {
          if (call.status === "completed") {
            return "border-green-200 bg-green-50/30";
          }
          if (isUpcoming) {
            return "border-blue-200 bg-blue-50/30";
          }
          return "border-amber-200 bg-amber-50/30";
        };

        return (
          <Card
            key={call.id}
            className={`relative overflow-hidden ${getCardStyle()}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  {time}
                </div>
                <CallStatusBadge status={call.status} />
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <div className="font-medium">{contactName}</div>
                </div>
                {companyName && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    {companyName}
                  </div>
                )}
                {property && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {property.address}, {property.city}
                  </div>
                )}
                {call.contact.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {call.contact.phone}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild className="flex-1">
                  <Link href={`/calls/${call.id}`}>
                    View Prep
                  </Link>
                </Button>
                <Button size="sm" asChild className="flex-1">
                  <Link href={`/calls/${call.id}`}>
                    {call.status === "completed" ? "View Notes" : "Start Call"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
