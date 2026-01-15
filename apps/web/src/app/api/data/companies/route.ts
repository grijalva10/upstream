import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search") || "";
  const status = searchParams.get("status");
  const type = searchParams.get("type"); // buyer, seller
  const hasProperties = searchParams.get("has_properties"); // yes, no
  const limit = parseInt(searchParams.get("limit") || "20");
  const page = parseInt(searchParams.get("page") || "1");
  const offset = (page - 1) * limit;

  let query = supabase
    .from("companies")
    .select("*, contacts(id), property_companies(id)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Apply search filter
  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  // Apply status filter
  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  // Apply type filter (buyer/seller)
  if (type === "buyer") {
    query = query.eq("is_buyer", true);
  } else if (type === "seller") {
    query = query.eq("is_seller", true);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transform data to include counts and filter by has_properties if needed
  let companies = data?.map((company) => ({
    ...company,
    contact_count: company.contacts?.length || 0,
    property_count: company.property_companies?.length || 0,
    contacts: undefined,
    property_companies: undefined,
  })) || [];

  // Filter by has_properties (done client-side since it's a computed field)
  let filteredTotal = count || 0;
  if (hasProperties === "yes") {
    companies = companies.filter((c) => c.property_count > 0);
    filteredTotal = companies.length;
  } else if (hasProperties === "no") {
    companies = companies.filter((c) => c.property_count === 0);
    filteredTotal = companies.length;
  }

  return NextResponse.json({
    companies,
    total: filteredTotal,
    page,
    limit,
  });
}
