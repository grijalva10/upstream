import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const supabase = createAdminClient();

    let query = supabase
      .from("campaigns")
      .select(`
        *,
        search:searches (id, name)
      `)
      .order("created_at", { ascending: false });

    if (status && ["draft", "active", "paused", "completed"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching campaigns:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Campaign list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { search_id, name } = body;

    if (!search_id || typeof search_id !== "string") {
      return NextResponse.json({ error: "search_id is required" }, { status: 400 });
    }

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify search exists and is ready
    const { data: search, error: searchError } = await supabase
      .from("searches")
      .select("id, status")
      .eq("id", search_id)
      .single();

    if (searchError || !search) {
      return NextResponse.json(
        { error: "Search not found" },
        { status: 404 }
      );
    }

    if (search.status !== "ready" && search.status !== "extraction_complete" && search.status !== "campaign_created") {
      return NextResponse.json(
        { error: "Search must be ready before creating a campaign" },
        { status: 400 }
      );
    }

    // Create campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .insert({
        search_id,
        name,
        status: "draft",
      })
      .select("id")
      .single();

    if (campaignError) {
      console.error("Error creating campaign:", campaignError);
      return NextResponse.json(
        { error: "Failed to create campaign" },
        { status: 500 }
      );
    }

    // Update search status
    await supabase
      .from("searches")
      .update({ status: "campaign_created" })
      .eq("id", search_id);

    return NextResponse.json({
      id: campaign.id,
      message: `Created campaign "${name}".`,
    });
  } catch (error) {
    console.error("Create campaign error:", error);
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}
