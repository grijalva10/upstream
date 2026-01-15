import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createSearchSchema,
  listSearchesSchema,
  formatZodError,
} from "@/app/(app)/searches/_lib/schemas";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");

    // Validate query params
    const parsed = listSearchesSchema.safeParse({
      status: statusParam || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    let query = supabase
      .from("searches")
      .select(`
        id, name, source, status, criteria_json, strategy_summary,
        payloads_json, total_properties, total_companies, total_contacts,
        source_contact_id, created_at, updated_at,
        campaigns (id, name, status, total_enrolled, total_sent, total_opened, total_replied)
      `)
      .order("created_at", { ascending: false });

    if (parsed.data.status) {
      query = query.eq("status", parsed.data.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching searches:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Search list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch searches" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    // Validate request body
    const parsed = createSearchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      );
    }

    const { name, source, criteria_json } = parsed.data;
    const supabase = createAdminClient();

    // Create search record
    const { data: search, error: searchError } = await supabase
      .from("searches")
      .insert({
        name,
        source,
        criteria_json,
        status: "pending_queries",
      })
      .select("id")
      .single();

    if (searchError) {
      console.error("Error creating search:", searchError);
      return NextResponse.json(
        { error: "Failed to create search" },
        { status: 500 }
      );
    }

    // Queue sourcing agent task via pg-boss
    const { error: taskError } = await supabase.rpc("queue_pgboss_job", {
      p_name: "generate-queries",
      p_data: {
        searchId: search.id,
        name,
        source,
        criteriaJson: criteria_json,
      },
      p_options: {
        priority: 7,
        retryLimit: 2,
      },
    });

    if (taskError) {
      console.error("Error creating task:", taskError);
      // Don't fail - search was created successfully
    }

    return NextResponse.json({
      id: search.id,
      status: "submitted",
      message: `Created search "${name}". Sourcing agent task queued.`,
    });
  } catch (error) {
    console.error("Create search error:", error);
    return NextResponse.json(
      { error: "Failed to create search" },
      { status: 500 }
    );
  }
}
