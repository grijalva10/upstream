import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const outcome = searchParams.get("outcome");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  let query = supabase
    .from("calls")
    .select(
      `
      id,
      scheduled_at,
      duration_minutes,
      status,
      outcome,
      notes_md,
      created_at,
      contact:contacts(
        id,
        first_name,
        last_name,
        email,
        phone,
        title,
        company:companies(id, name)
      ),
      deal:deals(
        id,
        display_id,
        asking_price,
        status,
        property:properties(id, address, city, state, property_type, sqft)
      )
    `,
      { count: "exact" }
    )
    .order("scheduled_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  if (outcome && outcome !== "all") {
    query = query.eq("outcome", outcome);
  }
  if (dateFrom) {
    query = query.gte("scheduled_at", dateFrom);
  }
  if (dateTo) {
    query = query.lte("scheduled_at", dateTo);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching calls:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    calls: data || [],
    total: count || 0,
    limit,
    offset,
  });
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { contact_id, deal_id, scheduled_at, duration_minutes, notes } = body;

    if (!contact_id) {
      return NextResponse.json(
        { error: "contact_id is required" },
        { status: 400 }
      );
    }

    if (!scheduled_at) {
      return NextResponse.json(
        { error: "scheduled_at is required" },
        { status: 400 }
      );
    }

    // Verify contact exists
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .eq("id", contact_id)
      .single();

    if (contactError || !contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // If deal_id provided, verify it exists
    if (deal_id) {
      const { data: deal, error: dealError } = await supabase
        .from("deals")
        .select("id")
        .eq("id", deal_id)
        .single();

      if (dealError || !deal) {
        return NextResponse.json({ error: "Deal not found" }, { status: 404 });
      }
    }

    // Create the call
    const { data: call, error: createError } = await supabase
      .from("calls")
      .insert({
        contact_id,
        deal_id: deal_id || null,
        scheduled_at,
        duration_minutes: duration_minutes || 30,
        notes_md: notes || null,
        status: "scheduled",
        action_items: [],
      })
      .select("id")
      .single();

    if (createError) {
      console.error("Error creating call:", createError);
      return NextResponse.json(
        { error: createError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: call.id,
      status: "created",
      message: `Call scheduled with ${contact.first_name} ${contact.last_name}`,
    });
  } catch (error) {
    console.error("Error in POST /api/calls:", error);
    return NextResponse.json(
      { error: "Failed to create call" },
      { status: 500 }
    );
  }
}
