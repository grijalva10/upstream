import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Legacy Sourcing Agent API
 *
 * DEPRECATED: Use the searches workflow instead:
 * 1. POST /api/searches - Create a new search
 * 2. POST /api/searches/[id]/run-agent - Generate payloads
 * 3. POST /api/searches/[id]/run-extraction - Extract data
 *
 * This endpoint is kept for backward compatibility but creates
 * a search record in the new schema.
 */
export async function POST(request: Request) {
  try {
    const { criteria } = await request.json();

    // Validate criteria structure
    if (!criteria || typeof criteria !== "object") {
      return NextResponse.json(
        { error: "Invalid criteria JSON" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Extract search name
    const searchName =
      criteria.criteria?.criteriaName ||
      criteria.criteria?.name ||
      criteria.buyer?.entityName ||
      criteria.buyer?.name ||
      `Search ${new Date().toLocaleDateString()}`;

    // Create a search record (new schema)
    const { data: search, error: searchError } = await supabase
      .from("searches")
      .insert({
        name: searchName,
        source: "api",
        criteria_json: criteria,
        status: "pending_queries",
      })
      .select("id")
      .single();

    if (searchError) {
      console.error("Error creating search:", searchError);
      return NextResponse.json(
        { error: "Failed to create search: " + searchError.message },
        { status: 500 }
      );
    }

    // Create agent_task to trigger sourcing agent
    const { error: taskError } = await supabase
      .from("agent_tasks")
      .insert({
        task_type: "generate_queries",
        priority: 7,
        status: "pending",
        input_data: {
          search_id: search.id,
          search_name: searchName,
          criteria_json: criteria,
        },
      });

    if (taskError) {
      console.error("Error creating task:", taskError);
      // Don't fail the request, just log it
    }

    return NextResponse.json({
      status: "submitted",
      message: `Created search "${searchName}". Sourcing agent task queued.`,
      searchId: search.id,
      // Backward compatibility
      criteriaId: search.id,
    });
  } catch (error) {
    console.error("Sourcing agent error:", error);
    return NextResponse.json(
      { error: "Failed to process criteria: " + (error as Error).message },
      { status: 500 }
    );
  }
}
