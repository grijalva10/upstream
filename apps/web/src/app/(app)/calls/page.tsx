import { createClient } from "@/lib/supabase/server";
import { startOfDay, endOfDay, addDays } from "date-fns";
import { transformCalls } from "@/lib/transforms";
import { CallsPageContent } from "./_components/calls-page-content";
import { ScheduleCallDialog } from "./_components/schedule-call-dialog";

async function getCallsData() {
  const supabase = await createClient();
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const upcomingEnd = endOfDay(addDays(now, 14));

  const selectQuery = `
    id,
    scheduled_at,
    duration_minutes,
    status,
    outcome,
    notes_md,
    contact:contacts(
      id,
      first_name,
      last_name,
      email,
      phone,
      company:companies(id, name)
    ),
    deal:deals(
      id,
      display_id,
      property:properties(id, address, city, state)
    )
  `;

  const [todaysResult, upcomingResult, pastResult] = await Promise.all([
    // Today's calls
    supabase
      .from("calls")
      .select(selectQuery)
      .gte("scheduled_at", todayStart.toISOString())
      .lte("scheduled_at", todayEnd.toISOString())
      .order("scheduled_at", { ascending: true }),

    // Upcoming calls (next 14 days, excluding today)
    supabase
      .from("calls")
      .select(selectQuery)
      .gt("scheduled_at", todayEnd.toISOString())
      .lte("scheduled_at", upcomingEnd.toISOString())
      .eq("status", "scheduled")
      .order("scheduled_at", { ascending: true }),

    // Past calls (last 30 days)
    supabase
      .from("calls")
      .select(selectQuery)
      .lt("scheduled_at", todayStart.toISOString())
      .order("scheduled_at", { ascending: false })
      .limit(100),
  ]);

  return {
    todaysCalls: transformCalls(todaysResult.data || []),
    upcomingCalls: transformCalls(upcomingResult.data || []),
    pastCalls: transformCalls(pastResult.data || []),
  };
}

export default async function CallsPage() {
  const { todaysCalls, upcomingCalls, pastCalls } = await getCallsData();

  const totalScheduled =
    todaysCalls.filter((c) => c.status === "scheduled").length +
    upcomingCalls.length;

  return (
    <div className="p-6 pb-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calls</h1>
          <p className="text-sm text-muted-foreground">
            {totalScheduled} scheduled call{totalScheduled !== 1 ? "s" : ""}
          </p>
        </div>
        <ScheduleCallDialog />
      </div>

      <CallsPageContent
        todaysCalls={todaysCalls}
        upcomingCalls={upcomingCalls}
        pastCalls={pastCalls}
      />
    </div>
  );
}
