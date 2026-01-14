import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    // Get current criteria
    const { data: criteria, error: fetchError } = await supabase
      .from("client_criteria")
      .select("id, status, client_id, name, criteria_json")
      .eq("id", id)
      .single();

    if (fetchError || !criteria) {
      return NextResponse.json(
        { error: "Criteria not found" },
        { status: 404 }
      );
    }

    // Only allow generating from draft or pending_review status
    if (!["draft", "pending_review"].includes(criteria.status)) {
      return NextResponse.json(
        { error: `Cannot generate queries from status: ${criteria.status}` },
        { status: 400 }
      );
    }

    // Update status to generating
    const { error: updateError } = await supabase
      .from("client_criteria")
      .update({ status: "generating" })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating criteria status:", updateError);
      return NextResponse.json(
        { error: "Failed to update criteria status" },
        { status: 500 }
      );
    }

    // Create agent task for sourcing agent
    const { error: taskError } = await supabase.from("agent_tasks").insert({
      task_type: "generate_queries",
      priority: 8,
      status: "pending",
      criteria_id: id,
      input_data: {
        criteria_id: id,
        client_id: criteria.client_id,
        criteria_name: criteria.name,
        criteria_json: criteria.criteria_json,
      },
    });

    if (taskError) {
      console.error("Error creating task:", taskError);
      // Revert status on task creation failure
      await supabase
        .from("client_criteria")
        .update({ status: "draft" })
        .eq("id", id);

      return NextResponse.json(
        { error: "Failed to create generation task" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "generating",
      message: "Query generation started. Use sourcing-agent to generate queries.",
      criteriaId: id,
    });
  } catch (error) {
    console.error("Generate queries error:", error);
    return NextResponse.json(
      { error: "Failed to start query generation: " + (error as Error).message },
      { status: 500 }
    );
  }
}
