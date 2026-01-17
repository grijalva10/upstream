import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runBatch } from "@upstream/claude-cli";
import { resolve } from "path";

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

    // Run via Claude CLI
    const result = await runBatch({
      prompt,
      maxTurns: 10,
      timeout: 300000, // 5 minutes
      cwd: resolve(process.cwd(), "../.."), // Project root
    });

    if (!result.success) {
      // Update search status to failed
      await supabase
        .from("searches")
        .update({ status: "failed" })
        .eq("id", id);

      return NextResponse.json({
        success: false,
        error: result.error || "Agent execution failed",
        output: result.output || "",
      });
    }

    // Parse the agent output to extract payloads JSON and strategy summary
    const output = result.output || "";
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
        strategy_summary: strategySummary.slice(0, 2000) || null,
      })
      .eq("id", id);

    return NextResponse.json({
      success: true,
      output: result.output,
      payloads: payloadsJson,
      strategy_summary: strategySummary,
      session_id: result.sessionId,
    });
  } catch (error) {
    console.error("Run agent error:", error);
    return NextResponse.json(
      { error: "Failed to run agent", details: String(error) },
      { status: 500 }
    );
  }
}
