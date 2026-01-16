import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { searchIdSchema, formatZodError } from "@/app/(app)/searches/_lib/schemas";

// PATCH - Retry generating queries
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    if (body.action !== "retry") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get search details
    const { data: search, error: fetchError } = await supabase
      .from("searches")
      .select("id, name, source, criteria_json, status")
      .eq("id", id)
      .single();

    if (fetchError || !search) {
      return NextResponse.json({ error: "Search not found" }, { status: 404 });
    }

    // Reset status to pending
    await supabase
      .from("searches")
      .update({ status: "pending_queries" })
      .eq("id", id);

    // Queue job via pg-boss
    const { error: taskError } = await supabase.rpc("queue_pgboss_job", {
      p_name: "generate-queries",
      p_data: {
        searchId: search.id,
        name: search.name,
        source: search.source,
        criteriaJson: search.criteria_json,
      },
      p_options: {
        priority: 7,
        retryLimit: 2,
      },
    });

    if (taskError) {
      console.error("Error queuing retry job:", taskError);
      return NextResponse.json({ error: taskError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: "Retry queued",
      id: search.id,
    });
  } catch (error) {
    console.error("Retry error:", error);
    return NextResponse.json({ error: "Failed to retry" }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate ID
    const parsed = searchIdSchema.safeParse({ id });

    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: search, error } = await supabase
      .from("searches")
      .select(`
        *,
        campaigns (id, name, status, total_enrolled, total_sent, total_opened, total_replied)
      `)
      .eq("id", parsed.data.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Search not found" }, { status: 404 });
      }
      console.error("Error fetching search:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch source contact if exists
    if (search.source_contact_id) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("id, name, email")
        .eq("id", search.source_contact_id)
        .single();

      search.source_contact = contact;
    }

    return NextResponse.json(search);
  } catch (error) {
    console.error("Get search error:", error);
    return NextResponse.json(
      { error: "Failed to fetch search" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate ID
    const parsed = searchIdSchema.safeParse({ id });

    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Check if search exists
    const { data: search, error: fetchError } = await supabase
      .from("searches")
      .select("id, name")
      .eq("id", parsed.data.id)
      .single();

    if (fetchError || !search) {
      return NextResponse.json({ error: "Search not found" }, { status: 404 });
    }

    // Delete the search (cascades to search_properties)
    const { error: deleteError } = await supabase
      .from("searches")
      .delete()
      .eq("id", parsed.data.id);

    if (deleteError) {
      console.error("Error deleting search:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: `Search "${search.name}" deleted`,
      id: parsed.data.id
    });
  } catch (error) {
    console.error("Delete search error:", error);
    return NextResponse.json(
      { error: "Failed to delete search" },
      { status: 500 }
    );
  }
}
