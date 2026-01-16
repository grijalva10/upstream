import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("calls")
    .select(
      `
      id,
      scheduled_at,
      duration_minutes,
      status,
      call_prep_md,
      notes_md,
      outcome,
      action_items,
      created_at,
      updated_at,
      contact:contacts(
        id,
        name,
        email,
        phone,
        title,
        company:companies(id, name, status)
      ),
      deal:deals(
        id,
        display_id,
        asking_price,
        noi,
        cap_rate,
        motivation,
        timeline,
        decision_maker_confirmed,
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
        ),
        company:companies(id, name)
      )
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching call:", error);
    return NextResponse.json(
      { error: error.message || "Call not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { status, notes_md, outcome, action_items, scheduled_at } = body;

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status !== undefined) {
      const validStatuses = [
        "scheduled",
        "completed",
        "no_show",
        "rescheduled",
        "cancelled",
      ];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
          { status: 400 }
        );
      }
      updates.status = status;
    }

    if (notes_md !== undefined) {
      updates.notes_md = notes_md;
    }

    if (outcome !== undefined) {
      const validOutcomes = [
        "qualified",
        "needs_followup",
        "not_interested",
        "reschedule",
        null,
      ];
      if (outcome !== null && !validOutcomes.includes(outcome)) {
        return NextResponse.json(
          { error: `Invalid outcome. Must be one of: ${validOutcomes.filter(Boolean).join(", ")}` },
          { status: 400 }
        );
      }
      updates.outcome = outcome;
    }

    if (action_items !== undefined) {
      updates.action_items = action_items;
    }

    if (scheduled_at !== undefined) {
      updates.scheduled_at = scheduled_at;
    }

    const { data, error } = await supabase
      .from("calls")
      .update(updates)
      .eq("id", id)
      .select("id, status, outcome, updated_at")
      .single();

    if (error) {
      console.error("Error updating call:", error);
      return NextResponse.json(
        { error: error.message || "Failed to update call" },
        { status: 500 }
      );
    }

    // If call is completed and has a deal, log activity
    if (status === "completed" && body.deal_id) {
      await supabase.from("deal_activity").insert({
        deal_id: body.deal_id,
        activity_type: "call_completed",
        description: outcome
          ? `Call completed - Outcome: ${outcome}`
          : "Call completed",
        metadata: { call_id: id, outcome },
      });
    }

    return NextResponse.json({
      success: true,
      call: data,
    });
  } catch (error) {
    console.error("Error in PATCH /api/calls/[id]:", error);
    return NextResponse.json(
      { error: "Failed to update call" },
      { status: 500 }
    );
  }
}
