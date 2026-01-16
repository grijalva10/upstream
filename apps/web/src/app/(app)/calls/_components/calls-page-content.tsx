"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Calendar, History } from "lucide-react";
import { TodaysCalls } from "./todays-calls";
import { UpcomingCallsTable } from "./upcoming-calls-table";
import { PastCallsTable } from "./past-calls-table";

interface Call {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  outcome: string | null;
  notes_md: string | null;
  contact: {
    id: string;
    name: string | null;
    phone?: string;
    email?: string;
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

interface CallsPageContentProps {
  todaysCalls: Call[];
  upcomingCalls: Call[];
  pastCalls: Call[];
}

export function CallsPageContent({
  todaysCalls,
  upcomingCalls,
  pastCalls,
}: CallsPageContentProps) {
  return (
    <Tabs defaultValue="today" className="space-y-4">
      <TabsList>
        <TabsTrigger value="today" className="gap-2">
          <Phone className="h-4 w-4" />
          Today
          {todaysCalls.length > 0 && (
            <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">
              {todaysCalls.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="upcoming" className="gap-2">
          <Calendar className="h-4 w-4" />
          Upcoming
          {upcomingCalls.length > 0 && (
            <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">
              {upcomingCalls.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="past" className="gap-2">
          <History className="h-4 w-4" />
          Past
          {pastCalls.length > 0 && (
            <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
              {pastCalls.length}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="today" className="space-y-4">
        <TodaysCalls calls={todaysCalls} />
      </TabsContent>

      <TabsContent value="upcoming" className="space-y-4">
        <UpcomingCallsTable calls={upcomingCalls} />
      </TabsContent>

      <TabsContent value="past" className="space-y-4">
        <PastCallsTable calls={pastCalls} />
      </TabsContent>
    </Tabs>
  );
}
