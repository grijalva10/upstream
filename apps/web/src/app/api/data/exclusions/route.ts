import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search") || "";
  const reason = searchParams.get("reason");
  const exclusionType = searchParams.get("type") || "email";
  const limit = parseInt(searchParams.get("limit") || "20");
  const page = parseInt(searchParams.get("page") || "1");
  const offset = (page - 1) * limit;
  const sort = searchParams.get("sort") || "created_at";
  const desc = searchParams.get("desc") !== "false";

  let query = supabase
    .from("exclusions")
    .select("*", { count: "exact" })
    .eq("exclusion_type", exclusionType)
    .order(sort, { ascending: !desc })
    .range(offset, offset + limit - 1);

  // Apply search filter
  if (search) {
    query = query.ilike("value", `%${search}%`);
  }

  // Apply reason filter
  if (reason && reason !== "all") {
    query = query.eq("reason", reason);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    exclusions: data,
    total: count || 0,
    page,
    limit,
  });
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const body = await request.json();

  const { value, exclusion_type = "email", reason = "manual", notes } = body;

  if (!value) {
    return NextResponse.json({ error: "Value is required" }, { status: 400 });
  }

  // Validate email format if type is email
  if (exclusion_type === "email") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }
  }

  // Check if already exists
  const { data: existing } = await supabase
    .from("exclusions")
    .select("id")
    .eq("exclusion_type", exclusion_type)
    .eq("value", value.toLowerCase())
    .single();

  if (existing) {
    return NextResponse.json(
      { error: `${exclusion_type} already on exclusion list` },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("exclusions")
    .insert({
      exclusion_type,
      value: value.toLowerCase(),
      reason,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ exclusion: data }, { status: 201 });
}
