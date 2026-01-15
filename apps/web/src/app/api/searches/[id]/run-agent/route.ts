import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8766";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const { criteria_json } = body;

    if (!criteria_json || typeof criteria_json !== "object") {
      return NextResponse.json(
        { error: "criteria_json is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get search details
    const { data: search, error: fetchError } = await supabase
      .from("searches")
      .select("id, name, source")
      .eq("id", id)
      .single();

    if (fetchError || !search) {
      return NextResponse.json({ error: "Search not found" }, { status: 404 });
    }

    // Update search with criteria and set status to generating
    await supabase
      .from("searches")
      .update({
        criteria_json,
        status: "generating_queries",
      })
      .eq("id", id);

    // Check if agent service is available
    let serviceAvailable = false;
    try {
      const statusRes = await fetch(`${AGENT_SERVICE_URL}/status`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      serviceAvailable = statusRes.ok;
    } catch {
      // Service not available
    }

    if (!serviceAvailable) {
      // Revert to draft status
      await supabase
        .from("searches")
        .update({ status: "draft" })
        .eq("id", id);

      return NextResponse.json(
        {
          error: `Agent service not available at ${AGENT_SERVICE_URL}. Start it with: python orchestrator/service.py`,
        },
        { status: 503 }
      );
    }

    // Build the prompt for the sourcing agent - request structured, concise output
    const prompt = `Generate CoStar API payloads for this buyer criteria:

\`\`\`json
${JSON.stringify(criteria_json, null, 2)}
\`\`\`

**YOUR TASK:** Generate 2-4 CoStar search payloads targeting motivated sellers. Do NOT run extraction - just generate the payloads.

**REQUIRED OUTPUT FORMAT:**

\`\`\`json
{
  "queries": [
    {
      "name": "Query Name",
      "rationale": "One sentence why this targets motivated sellers",
      "payload": {
        "0": {
          "BoundingBox": {"UpperLeft": {"Latitude": 53.91, "Longitude": -143.15}, "LowerRight": {"Latitude": 14.96, "Longitude": -58.77}},
          "Geography": {"Filter": {"FilterType": 132, "Ids": [MARKET_ID]}},
          "Property": {
            "PropertyTypes": [PROPERTY_TYPE_IDS],
            "Building": {"ConstructionStatuses": [1]},
            "OwnerTypes": [OWNER_TYPE_IDS],
            "LastSoldDate": {"Maximum": "DATE"}
          },
          "ListingType": 0
        },
        "1": 100,
        "2": 1,
        "3": {"RateBasis": "month", "CurrencyCode": "USD", "BuildingAreaUnit": "SF", "secondaryAreaUnit": "SF", "AreaUom": "AC", "lengthUnit": "FT"},
        "4": false,
        "5": []
      }
    }
  ]
}
\`\`\`

Then add a 3-5 bullet strategy summary.

**RULES:**
- Use EXACT IDs from the COSTAR API REFERENCE DATA section (markets, property types, owner types)
- Always use ListingType: 0 (off-market)
- Use FilterType: 132 for market geography
- Output the JSON block FIRST, then the summary`;

    // Call the agent service
    const agentRes = await fetch(`${AGENT_SERVICE_URL}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent: "sourcing-agent",
        prompt,
        context: { criteria_type: criteria_json.type, search_id: id },
        max_turns: 10,  // Need enough turns to generate multiple payloads
      }),
    });

    const agentResult = await agentRes.json();

    if (!agentResult.success) {
      // Update search status to failed
      await supabase
        .from("searches")
        .update({ status: "failed" })
        .eq("id", id);

      return NextResponse.json({
        success: false,
        error: agentResult.error || "Agent execution failed",
        output: agentResult.output || "",
        execution_id: agentResult.execution_id,
      });
    }

    // Parse the agent output to extract payloads JSON and strategy summary
    const output = agentResult.output || "";
    let payloadsJson = null;
    let strategySummary = output;

    // Try to extract JSON block from output
    const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        payloadsJson = JSON.parse(jsonMatch[1]);
        // Extract strategy summary (everything after the JSON block)
        const jsonEndIndex = output.indexOf("```", output.indexOf("```json") + 7);
        if (jsonEndIndex !== -1) {
          strategySummary = output.slice(jsonEndIndex + 3).trim();
        }
      } catch {
        // Failed to parse JSON, keep full output as summary
        console.warn("Failed to parse payloads JSON from agent output");
      }
    }

    // Update search with parsed data
    await supabase
      .from("searches")
      .update({
        status: "pending_extraction",
        payloads_json: payloadsJson,
        strategy_summary: strategySummary.slice(0, 2000) || null,  // Allow full summary
      })
      .eq("id", id);

    return NextResponse.json({
      success: true,
      output: agentResult.output,
      payloads: payloadsJson,
      strategy_summary: strategySummary,
      execution_id: agentResult.execution_id,
      session_id: agentResult.session_id,
    });
  } catch (error) {
    console.error("Run agent error:", error);
    return NextResponse.json(
      { error: "Failed to run agent", details: String(error) },
      { status: 500 }
    );
  }
}
