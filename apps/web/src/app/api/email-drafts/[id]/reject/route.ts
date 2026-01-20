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

  // Don't auto-complete the task - user might want to handle it differently
  // They can dismiss/complete manually from inbox

  return NextResponse.json({
    success: true,
    draft_id: id,
    message: "Draft rejected",
  });
}
