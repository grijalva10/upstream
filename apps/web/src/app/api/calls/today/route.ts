import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();

  // Get today's date range in UTC
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from("calls")
    .select(
      `
      id,
      scheduled_at,
      duration_minutes,
      status,
      contact:contacts(
        id,
        name,
        phone,
        lead:leads(id, name)
      ),
      deal:deals(
        id,
        display_id,
        property:properties(id, address, city, state_code)
      )
    `
    )
    .gte("scheduled_at", todayStart.toISOString())
    .lte("scheduled_at", todayEnd.toISOString())
    .in("status", ["scheduled", "completed"])
    .order("scheduled_at", { ascending: true });

  if (error) {
    console.error("Error fetching today's calls:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    calls: data || [],
    date: todayStart.toISOString().split("T")[0],
  });
}
