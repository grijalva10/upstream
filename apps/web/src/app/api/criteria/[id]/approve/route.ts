import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    // Get current criteria to verify status
    const { data: criteria, error: fetchError } = await supabase
      .from("client_criteria")
      .select("id, status, client_id, name, queries_json")
      .eq("id", id)
      .single();

    if (fetchError || !criteria) {
      return NextResponse.json(
        { error: "Criteria not found" },
        { status: 404 }
      );
    }

    if (criteria.status !== "pending_approval") {
      return NextResponse.json(
        { error: `Cannot approve criteria with status: ${criteria.status}` },
        { status: 400 }
      );
    }

    // Update status to approved
    const { error: updateError } = await supabase
      .from("client_criteria")
      .update({ status: "approved" })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating criteria status:", updateError);
      return NextResponse.json(
        { error: "Failed to update criteria status" },
        { status: 500 }
      );
    }

    // Create agent task for extraction
    const { error: taskError } = await supabase.from("agent_tasks").insert({
      task_type: "run_extraction",
      priority: 8,
      status: "pending",
      criteria_id: id,
      input_data: {
        criteria_id: id,
        client_id: criteria.client_id,
        criteria_name: criteria.name,
        queries_json: criteria.queries_json,
      },
    });

    if (taskError) {
      console.error("Error creating extraction task:", taskError);
      // Don't fail the request, just log it
    }

    return NextResponse.json({
      status: "approved",
      message: "Criteria approved. Extraction task queued.",
      criteriaId: id,
    });
  } catch (error) {
    console.error("Approve criteria error:", error);
    return NextResponse.json(
      { error: "Failed to approve criteria: " + (error as Error).message },
      { status: 500 }
    );
  }
}
