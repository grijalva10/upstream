import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { spawn } from "child_process";
import path from "path";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    // Get current criteria with queries
    const { data: criteria, error: fetchError } = await supabase
      .from("client_criteria")
      .select("id, status, client_id, name, queries_json, source_file")
      .eq("id", id)
      .single();

    if (fetchError || !criteria) {
      return NextResponse.json(
        { error: "Criteria not found" },
        { status: 404 }
      );
    }

    // Must have queries to extract
    if (!criteria.queries_json) {
      return NextResponse.json(
        { error: "No queries generated yet. Generate queries first." },
        { status: 400 }
      );
    }

    // Only allow extraction from certain statuses
    if (!["pending_review", "approved", "active"].includes(criteria.status)) {
      return NextResponse.json(
        { error: `Cannot run extraction from status: ${criteria.status}` },
        { status: 400 }
      );
    }

    // Update status to extracting
    const { error: updateError } = await supabase
      .from("client_criteria")
      .update({ status: "extracting" })
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
      priority: 9,
      status: "pending",
      criteria_id: id,
      input_data: {
        criteria_id: id,
        client_id: criteria.client_id,
        criteria_name: criteria.name,
        queries_json: criteria.queries_json,
        source_file: criteria.source_file,
      },
    });

    if (taskError) {
      console.error("Error creating extraction task:", taskError);
    }

    // If source_file exists, try to run extraction directly
    if (criteria.source_file) {
      try {
        const projectRoot = path.resolve(process.cwd(), "../..");
        const scriptPath = path.join(projectRoot, "scripts", "run_extraction.py");
        const payloadPath = path.join(projectRoot, criteria.source_file);

        // Spawn extraction process in background
        const child = spawn("python", [scriptPath, payloadPath], {
          cwd: projectRoot,
          detached: true,
          stdio: "ignore",
        });

        child.unref();

        return NextResponse.json({
          status: "extracting",
          message: "Extraction started from saved payload file.",
          criteriaId: id,
          sourceFile: criteria.source_file,
        });
      } catch (spawnError) {
        console.error("Failed to spawn extraction:", spawnError);
        // Continue - task is queued anyway
      }
    }

    return NextResponse.json({
      status: "extracting",
      message: "Extraction task queued. Run extraction manually or wait for orchestrator.",
      criteriaId: id,
    });
  } catch (error) {
    console.error("Extract error:", error);
    return NextResponse.json(
      { error: "Failed to start extraction: " + (error as Error).message },
      { status: 500 }
    );
  }
}
