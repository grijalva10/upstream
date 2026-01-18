import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search") || "";
  const reason = searchParams.get("reason");
  const source = searchParams.get("source");
  const limit = parseInt(searchParams.get("limit") || "20");
  const page = parseInt(searchParams.get("page") || "1");
  const offset = (page - 1) * limit;
  const sort = searchParams.get("sort") || "added_at";
  const desc = searchParams.get("desc") !== "false"; // default to descending

  let query = supabase
    .from("dnc_entries")
    .select("*", { count: "exact" })
    .order(sort, { ascending: !desc })
    .range(offset, offset + limit - 1);

  // Apply search filter (search email, phone, or company_name)
  if (search) {
    query = query.or(`email.ilike.%${search}%,phone.ilike.%${search}%,company_name.ilike.%${search}%`);
  }

  // Apply reason filter
  if (reason && reason !== "all") {
    query = query.eq("reason", reason);
  }

  // Apply source filter
  if (source && source !== "all") {
    query = query.eq("source", source);
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

  const { email, phone, company_name, reason, notes } = body;

  if (!email && !phone) {
    return NextResponse.json({ error: "Email or phone is required" }, { status: 400 });
  }

  // Validate email format if provided
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }
  }

  // Check if already exists (by email or phone)
  if (email) {
    const { data: existingEmail } = await supabase
      .from("dnc_entries")
      .select("id")
      .eq("email", email.toLowerCase())
      .single();

    if (existingEmail) {
      return NextResponse.json({ error: "Email already on DNC list" }, { status: 409 });
    }
  }

  if (phone) {
    const { data: existingPhone } = await supabase
      .from("dnc_entries")
      .select("id")
      .eq("phone", phone)
      .single();

    if (existingPhone) {
      return NextResponse.json({ error: "Phone already on DNC list" }, { status: 409 });
    }
  }

  const { data, error } = await supabase
    .from("dnc_entries")
    .insert({
      email: email?.toLowerCase() || null,
      phone: phone || null,
      company_name: company_name || null,
      reason: reason || "manual",
      source: "manual",
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ exclusion: data }, { status: 201 });
}
