import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Campaign ID required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select(`
        *,
        search:searches (id, name)
      `)
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }
      console.error("Error fetching campaign:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(campaign);
  } catch (error) {
    console.error("Get campaign error:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Campaign ID required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const validStatuses = ["draft", "active", "paused", "completed"];

    // Build update object from allowed fields
    const updates: Record<string, unknown> = {};

    if (body.name && typeof body.name === "string") {
      updates.name = body.name;
    }

    if (body.status && validStatuses.includes(body.status)) {
      updates.status = body.status;
      // Handle status transitions
      if (body.status === "active") {
        updates.started_at = new Date().toISOString();
      } else if (body.status === "completed") {
        updates.completed_at = new Date().toISOString();
      }
    }

    if (body.email_1_subject !== undefined) updates.email_1_subject = body.email_1_subject;
    if (body.email_1_body !== undefined) updates.email_1_body = body.email_1_body;
    if (body.email_2_subject !== undefined) updates.email_2_subject = body.email_2_subject;
    if (body.email_2_body !== undefined) updates.email_2_body = body.email_2_body;
    if (body.email_2_delay_days !== undefined) updates.email_2_delay_days = body.email_2_delay_days;
    if (body.email_3_subject !== undefined) updates.email_3_subject = body.email_3_subject;
    if (body.email_3_body !== undefined) updates.email_3_body = body.email_3_body;
    if (body.email_3_delay_days !== undefined) updates.email_3_delay_days = body.email_3_delay_days;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: campaign, error } = await supabase
      .from("campaigns")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }
      console.error("Error updating campaign:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(campaign);
  } catch (error) {
    console.error("Update campaign error:", error);
    return NextResponse.json(
      { error: "Failed to update campaign" },
      { status: 500 }
    );
  }
}
