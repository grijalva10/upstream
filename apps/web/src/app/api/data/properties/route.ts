import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search") || "";
  const propertyType = searchParams.get("property_type");
  const buildingClass = searchParams.get("building_class");
  const size = searchParams.get("size"); // small, medium, large, xlarge
  const year = searchParams.get("year"); // 2020s, 2010s, 2000s, 1990s, older
  const limit = parseInt(searchParams.get("limit") || "20");
  const page = parseInt(searchParams.get("page") || "1");
  const offset = (page - 1) * limit;

  let query = supabase
    .from("properties")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Apply search filter
  if (search) {
    query = query.ilike("address", `%${search}%`);
  }

  // Apply property type filter
  if (propertyType && propertyType !== "all") {
    query = query.eq("property_type", propertyType);
  }

  // Apply building class filter
  if (buildingClass && buildingClass !== "all") {
    query = query.eq("building_class", buildingClass);
  }

  // Apply size filter
  if (size && size !== "all") {
    switch (size) {
      case "small":
        query = query.lt("building_size_sqft", 10000);
        break;
      case "medium":
        query = query.gte("building_size_sqft", 10000).lt("building_size_sqft", 50000);
        break;
      case "large":
        query = query.gte("building_size_sqft", 50000).lt("building_size_sqft", 100000);
        break;
      case "xlarge":
        query = query.gte("building_size_sqft", 100000);
        break;
    }
  }

  // Apply year built filter
  if (year && year !== "all") {
    switch (year) {
      case "2020s":
        query = query.gte("year_built", 2020);
        break;
      case "2010s":
        query = query.gte("year_built", 2010).lt("year_built", 2020);
        break;
      case "2000s":
        query = query.gte("year_built", 2000).lt("year_built", 2010);
        break;
      case "1990s":
        query = query.gte("year_built", 1990).lt("year_built", 2000);
        break;
      case "older":
        query = query.lt("year_built", 1990);
        break;
    }
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    properties: data,
    total: count || 0,
    page,
    limit,
  });
}
