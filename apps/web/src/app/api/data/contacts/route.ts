import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search") || "";
  const status = searchParams.get("status");
  const type = searchParams.get("type"); // buyer, seller
  const isDecisionMaker = searchParams.get("is_decision_maker"); // true, false
  const limit = parseInt(searchParams.get("limit") || "20");
  const page = parseInt(searchParams.get("page") || "1");
  const offset = (page - 1) * limit;
  const sort = searchParams.get("sort") || "created_at";
  const desc = searchParams.get("desc") === "true";

  let query = supabase
    .from("contacts")
    .select("*, company:companies(id, name)", { count: "exact" })
    .order(sort, { ascending: !desc })
    .range(offset, offset + limit - 1);

  // Apply search filter
  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
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

  // Apply decision maker filter
  if (isDecisionMaker === "true") {
    query = query.eq("is_decision_maker", true);
  } else if (isDecisionMaker === "false") {
    query = query.eq("is_decision_maker", false);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    contacts: data,
    total: count || 0,
    page,
    limit,
  });
}
