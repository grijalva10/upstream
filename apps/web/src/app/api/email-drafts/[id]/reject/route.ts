import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = createAdminClient();

  // Get optional reason from body
  let reason: string | undefined;
  try {
    const body = await request.json();
    reason = body.reason;
  } catch {
    // No body is fine
  }

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

  // Update draft status to rejected
  const { error: updateError } = await supabase
    .from("email_drafts")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to reject draft" },
      { status: 500 }
    );
  }

  // Complete the associated task (moves to archive)
  // Find task by contact_id + type
  if (draft.contact_id) {
    await supabase
      .from("tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("contact_id", draft.contact_id)
      .eq("type", "incoming_email")
      .in("status", ["pending", "snoozed"]);
  }

  return NextResponse.json({
    success: true,
    draft_id: id,
    message: "Draft dismissed and task completed",
  });
}
