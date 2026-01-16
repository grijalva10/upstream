import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search") || "";
  const status = searchParams.get("status");
  const companyId = searchParams.get("company_id");
  const limit = parseInt(searchParams.get("limit") || "20");
  const page = parseInt(searchParams.get("page") || "1");
  const offset = (page - 1) * limit;

  let query = supabase
    .from("deals")
    .select(
      `
      id,
      display_id,
      asking_price,
      noi,
      status,
      created_at,
      property:properties(id, address, city, state, property_type),
      company:companies(id, name),
      contact:contacts(id, name, email)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(
      `display_id.ilike.%${search}%,property.address.ilike.%${search}%`
    );
  }

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching deals:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    deals: data || [],
    total: count || 0,
    page,
    limit,
  });
}
