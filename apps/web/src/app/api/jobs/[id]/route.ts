import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("email_queue")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();
  const body = await request.json();

  const { action } = body;

  if (action === "retry") {
    // Reset job for retry
    const { data, error } = await supabase
      .from("email_queue")
      .update({
        status: "pending",
        attempts: 0,
        last_error: null,
        next_retry_at: null,
        scheduled_for: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "failed")
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Job not found or not in failed state" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, job: data });
  }

  if (action === "cancel") {
    // Cancel pending/scheduled job
    const { data, error } = await supabase
      .from("email_queue")
      .update({
        status: "cancelled",
      })
      .eq("id", id)
      .in("status", ["pending", "scheduled"])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Job not found or cannot be cancelled" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, job: data });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  // Only allow deleting cancelled or failed jobs
  const { error } = await supabase
    .from("email_queue")
    .delete()
    .eq("id", id)
    .in("status", ["cancelled", "failed"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
