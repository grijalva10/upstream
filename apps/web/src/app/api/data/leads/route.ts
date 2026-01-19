import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search") || "";
  const status = searchParams.get("status");
  const qualificationStatus = searchParams.get("qualification_status");
  const source = searchParams.get("source");
  const type = searchParams.get("type"); // buyer, seller
  const hasBroker = searchParams.get("has_broker"); // yes, no
  const hasProperties = searchParams.get("has_properties"); // yes, no
  const limit = parseInt(searchParams.get("limit") || "20");
  const page = parseInt(searchParams.get("page") || "1");
  const offset = (page - 1) * limit;
  const sort = searchParams.get("sort") || "created_at";
  const desc = searchParams.get("desc") === "true";

  let query = supabase
    .from("leads")
    .select("*, contacts(id), property_leads(property_id)", { count: "exact" })
    .order(sort, { ascending: !desc })
    .range(offset, offset + limit - 1);

  // Apply search filter
  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  // Apply status filter
  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  // Apply qualification status filter
  if (qualificationStatus && qualificationStatus !== "all") {
    query = query.eq("qualification_status", qualificationStatus);
  }

  // Apply source filter
  if (source && source !== "all") {
    query = query.eq("source", source);
  }

  // Apply type filter (buyer/seller)
  if (type === "buyer") {
    query = query.eq("is_buyer", true);
  } else if (type === "seller") {
    query = query.eq("is_seller", true);
  }

  // Apply has_broker filter
  if (hasBroker === "yes") {
    query = query.eq("has_broker", true);
  } else if (hasBroker === "no") {
    query = query.eq("has_broker", false);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transform data to include counts and filter by has_properties if needed
  let leads = data?.map((lead) => ({
    ...lead,
    contact_count: lead.contacts?.length || 0,
    property_count: lead.property_leads?.length || 0,
    contacts: undefined,
    property_leads: undefined,
  })) || [];

  // Filter by has_properties (done client-side since it's a computed field)
  let filteredTotal = count || 0;
  if (hasProperties === "yes") {
    leads = leads.filter((l) => l.property_count > 0);
    filteredTotal = leads.length;
  } else if (hasProperties === "no") {
    leads = leads.filter((l) => l.property_count === 0);
    filteredTotal = leads.length;
  }

  return NextResponse.json({
    leads,
    total: filteredTotal,
    page,
    limit,
  });
}
