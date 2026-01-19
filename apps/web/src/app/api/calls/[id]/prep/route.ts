import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateCallPrep } from "@/lib/call-prep-template";
import { transformCall } from "@/lib/transforms";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: call, error } = await supabase
    .from("calls")
    .select("id, call_prep_md")
    .eq("id", id)
    .single();

  if (error || !call) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  return NextResponse.json({
    call_prep_md: call.call_prep_md,
    has_prep: !!call.call_prep_md,
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = createAdminClient();

  // Fetch call with all related data for prep generation
  const { data: rawCall, error: callError } = await supabase
    .from("calls")
    .select(
      `
      id,
      scheduled_at,
      contact:contacts(
        id,
        name,
        email,
        phone,
        title,
        lead:leads(id, name, status)
      ),
      deal:deals(
        id,
        display_id,
        asking_price,
        noi,
        motivation,
        timeline,
        status,
        property:properties(
          id,
          address,
          city,
          state,
          zip,
          property_type,
          sqft,
          building_class,
          year_built
        )
      )
    `
    )
    .eq("id", id)
    .single();

  if (callError || !rawCall) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  const call = transformCall(rawCall);

  // Fetch recent activity if deal exists
  let recentActivity: Array<{ activity_type: string; description: string; created_at: string }> = [];
  if (call.deal?.id) {
    const { data: activity } = await supabase
      .from("deal_activity")
      .select("activity_type, description, created_at")
      .eq("deal_id", call.deal.id)
      .order("created_at", { ascending: false })
      .limit(10);
    recentActivity = activity || [];
  }

  // Generate the prep document
  const prepMd = generateCallPrep({
    contact: call.contact,
    lead: call.contact?.lead,
    property: call.deal?.property,
    deal: call.deal,
    scheduledAt: call.scheduled_at,
    recentActivity,
  });

  // Save to database
  const { error: updateError } = await supabase
    .from("calls")
    .update({
      call_prep_md: prepMd,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    console.error("Error saving call prep:", updateError);
    return NextResponse.json(
      { error: "Failed to save call prep" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    call_prep_md: prepMd,
  });
}
