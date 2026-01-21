import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_STATUSES = [
  "new",
  "contacted",
  "engaged",
  "qualified",
  "handed_off",
  "nurture",
  "pass",
  "dnc",
  "rejected",
];

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: leadId } = await params;
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { status } = body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    // Get current status for activity log
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, name, status")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const oldStatus = lead.status;

    // Update lead status (trigger will handle DNC exclusions)
    const { error: updateError } = await supabase
      .from("leads")
      .update({ status })
      .eq("id", leadId);

    if (updateError) {
      console.error("Error updating lead status:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Log status change as activity
    await supabase.from("activities").insert({
      lead_id: leadId,
      activity_type: "status_change",
      body_text: `Status changed from ${oldStatus} to ${status}`,
      activity_at: new Date().toISOString(),
      metadata: {
        old_status: oldStatus,
        new_status: status,
      },
    });

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error("Error in PATCH /api/leads/[id]/status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
