import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search") || "";
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") || "20");
  const page = parseInt(searchParams.get("page") || "1");
  const offset = (page - 1) * limit;
  const sort = searchParams.get("sort") || "created_at";
  const desc = searchParams.get("desc") !== "false"; // Default to descending

  let query = supabase
    .from("campaigns")
    .select("*, search:searches(id, name)", { count: "exact" })
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

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    campaigns: data,
    total: count || 0,
    page,
    limit,
  });
}
