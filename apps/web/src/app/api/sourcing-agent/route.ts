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

    return NextResponse.json({
      status: "submitted",
      message: `Created search "${searchName}". Use POST /api/searches/${search.id}/run-agent to generate queries.`,
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
