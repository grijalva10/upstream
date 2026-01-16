import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search") || "";
  const reason = searchParams.get("reason");
  const bounceType = searchParams.get("bounce_type");
  const limit = parseInt(searchParams.get("limit") || "20");
  const page = parseInt(searchParams.get("page") || "1");
  const offset = (page - 1) * limit;
  const sort = searchParams.get("sort") || "created_at";
  const desc = searchParams.get("desc") !== "false"; // default to descending

  let query = supabase
    .from("email_exclusions")
    .select("*", { count: "exact" })
    .order(sort, { ascending: !desc })
    .range(offset, offset + limit - 1);

  // Apply search filter
  if (search) {
    query = query.ilike("email", `%${search}%`);
  }

  // Apply reason filter
  if (reason && reason !== "all") {
    query = query.eq("reason", reason);
  }

  // Apply bounce type filter
  if (bounceType && bounceType !== "all") {
    query = query.eq("bounce_type", bounceType);
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

  const { email, reason } = body;

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }

  // Check if already exists
  const { data: existing } = await supabase
    .from("email_exclusions")
    .select("id")
    .eq("email", email.toLowerCase())
    .single();

  if (existing) {
    return NextResponse.json({ error: "Email already excluded" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("email_exclusions")
    .insert({
      email: email.toLowerCase(),
      reason: reason || "manual",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ exclusion: data }, { status: 201 });
}
