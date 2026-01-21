import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = createAdminClient();

  // Get the task
  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !task) {
    return NextResponse.json(
      { error: "Task not found" },
      { status: 404 }
    );
  }

  if (task.status !== "completed" && task.status !== "cancelled") {
    return NextResponse.json(
      { error: "Task is not in archive" },
      { status: 400 }
    );
  }

  // Reopen the task - set to pending, due today
  const today = new Date().toISOString().split("T")[0];

  const { error: updateError } = await supabase
    .from("tasks")
    .update({
      status: "pending",
      completed_at: null,
      due_date: today,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to reopen task" },
      { status: 500 }
    );
  }

  // Restore any rejected draft for this contact
  if (task.contact_id) {
    await supabase
      .from("email_drafts")
      .update({
        status: "pending",
        reviewed_at: null,
      })
      .eq("contact_id", task.contact_id)
      .eq("status", "rejected");
  }

  return NextResponse.json({
    success: true,
    task_id: id,
    message: "Task reopened",
  });
}
