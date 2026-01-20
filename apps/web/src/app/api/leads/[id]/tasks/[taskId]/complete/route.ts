import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string; taskId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: leadId, taskId } = await params;
  const supabase = createAdminClient();

  try {
    // Verify task exists and belongs to lead
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, lead_id")
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (task.lead_id !== leadId) {
      return NextResponse.json(
        { error: "Task does not belong to this lead" },
        { status: 400 }
      );
    }

    // Mark task as completed
    const { error } = await supabase
      .from("tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (error) {
      console.error("Error completing task:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in POST /api/leads/[id]/tasks/[taskId]/complete:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
