import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search");
  const limit = parseInt(searchParams.get("limit") || "20");

  let query = supabase
    .from("properties")
    .select("id, address, property_type, building_size_sqft, building_class, year_built")
    .order("address", { ascending: true })
    .limit(limit);

  if (search) {
    query = query.ilike("address", `%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ properties: data });
}
