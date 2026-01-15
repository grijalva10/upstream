import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  campaignIdSchema,
  updateCampaignSchema,
  formatZodError,
} from "@/app/(app)/campaigns/_lib/schemas";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const parsed = campaignIdSchema.safeParse({ id });

    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select(`
        *,
        search:searches (id, name)
      `)
      .eq("id", parsed.data.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }
      console.error("Error fetching campaign:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(campaign);
  } catch (error) {
    console.error("Get campaign error:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const idParsed = campaignIdSchema.safeParse({ id });
    if (!idParsed.success) {
      return NextResponse.json(
        { error: formatZodError(idParsed.error) },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = updateCampaignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Build update object
    const updates: Record<string, unknown> = { ...parsed.data };

    // Handle status transitions
    if (parsed.data.status === "active") {
      updates.started_at = new Date().toISOString();
    } else if (parsed.data.status === "completed") {
      updates.completed_at = new Date().toISOString();
    }

    const { data: campaign, error } = await supabase
      .from("campaigns")
      .update(updates)
      .eq("id", idParsed.data.id)
      .select("*")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }
      console.error("Error updating campaign:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(campaign);
  } catch (error) {
    console.error("Update campaign error:", error);
    return NextResponse.json(
      { error: "Failed to update campaign" },
      { status: 500 }
    );
  }
}
