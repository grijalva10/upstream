import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { COSTAR_SERVICE_URL } from "@/lib/constants";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    // Get search with payloads
    const { data: search, error: fetchError } = await supabase
      .from("searches")
      .select("id, name, payloads_json")
      .eq("id", id)
      .single();

    if (fetchError || !search) {
      return NextResponse.json({ error: "Search not found" }, { status: 404 });
    }

    const payloads = search.payloads_json?.queries;
    if (!payloads?.length) {
      return NextResponse.json(
        { error: "No payloads to count. Run the sourcing agent first." },
        { status: 400 }
      );
    }

    // Check CoStar service status
    let serviceStatus;
    try {
      const statusRes = await fetch(`${COSTAR_SERVICE_URL}/status`);
      serviceStatus = await statusRes.json();
    } catch {
      return NextResponse.json(
        { error: "CoStar service not available" },
        { status: 503 }
      );
    }

    if (serviceStatus.status !== "connected" || !serviceStatus.session_valid) {
      return NextResponse.json(
        { error: "CoStar session not connected or expired" },
        { status: 503 }
      );
    }

    // Extract just the payload objects
    const payloadObjects = payloads.map((p: { payload?: unknown; name?: string }) => p.payload ?? p);

    // Call count endpoint
    const countRes = await fetch(`${COSTAR_SERVICE_URL}/count`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: payloadObjects,
        timeout: 120,
      }),
    });

    if (!countRes.ok) {
      const error = await countRes.json().catch(() => ({ error: "Count failed" }));
      return NextResponse.json(
        { error: error.error || "Count failed" },
        { status: countRes.status }
      );
    }

    const result = await countRes.json();

    // Add payload names to the counts
    const countsWithNames = result.counts.map((count: { payload_index: number; property_count: number }, i: number) => ({
      ...count,
      name: payloads[i]?.name || `Query ${i + 1}`,
    }));

    return NextResponse.json({
      counts: countsWithNames,
      total_properties: result.total_properties,
      payload_count: result.payload_count,
    });

  } catch (error) {
    console.error("Count error:", error);
    return NextResponse.json(
      { error: "Failed to get counts", details: String(error) },
      { status: 500 }
    );
  }
}
