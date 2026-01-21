import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = createAdminClient();

  // Get the draft
  const { data: draft, error: fetchError } = await supabase
    .from("email_drafts")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !draft) {
    return NextResponse.json(
      { error: "Draft not found" },
      { status: 404 }
    );
  }

  if (draft.status !== "pending") {
    return NextResponse.json(
      { error: `Draft is already ${draft.status}` },
      { status: 400 }
    );
  }

  // Check for exclusions before approving
  const { data: exclusion } = await supabase
    .from("exclusions")
    .select("id, reason")
    .eq("exclusion_type", "email")
    .eq("value", draft.to_email.toLowerCase())
    .single();

  if (exclusion) {
    return NextResponse.json(
      { error: `Email is excluded: ${exclusion.reason}` },
      { status: 400 }
    );
  }

  // Update draft status to approved
  const { error: updateError } = await supabase
    .from("email_drafts")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to approve draft" },
      { status: 500 }
    );
  }

  // Map draft_type to job_type
  const jobTypeMap: Record<string, string> = {
    hot_response: "manual_reply",
    question_answer: "manual_reply",
    cold_outreach: "cold_outreach",
    follow_up: "follow_up",
    qualification: "qualification",
    scheduling: "scheduling",
    escalation: "manual_reply",
  };

  const jobType = jobTypeMap[draft.draft_type] || "manual_reply";

  // Create email_queue entry
  const { data: queueEntry, error: queueError } = await supabase
    .from("email_queue")
    .insert({
      job_type: jobType,
      priority: 8, // High priority for approved drafts
      source: "user",
      to_email: draft.to_email,
      to_name: draft.to_name,
      subject: draft.subject,
      body_text: draft.body,
      contact_id: draft.contact_id,
      lead_id: draft.lead_id,
      property_id: draft.property_id,
      in_reply_to_email_id: draft.source_email_id,
      status: "pending",
      scheduled_for: new Date().toISOString(),
      created_by: "user-approved",
    })
    .select()
    .single();

  if (queueError) {
    console.error("Failed to queue email:", queueError);
    // Rollback draft status
    await supabase
      .from("email_drafts")
      .update({ status: "pending", reviewed_at: null })
      .eq("id", id);

    return NextResponse.json(
      { error: "Failed to queue email for sending" },
      { status: 500 }
    );
  }

  // Complete any related incoming_email task
  if (draft.contact_id) {
    await supabase
      .from("tasks")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("type", "incoming_email")
      .eq("contact_id", draft.contact_id)
      .in("status", ["pending", "snoozed"]);
  }

  return NextResponse.json({
    success: true,
    draft_id: id,
    queue_id: queueEntry.id,
    message: "Draft approved and queued for sending",
  });
}
