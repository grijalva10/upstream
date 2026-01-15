import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * API route to fetch pg-boss system jobs via RPC function.
 * These are the background jobs that run scheduled tasks.
 */
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  const state = searchParams.get("state") || null;
  const name = searchParams.get("name") || null;
  const limit = parseInt(searchParams.get("limit") || "100");
  const offset = parseInt(searchParams.get("offset") || "0");

  // Query via RPC function that can access pgboss schema
  const { data, error } = await supabase.rpc("get_pgboss_jobs", {
    p_state: state === "all" ? null : state,
    p_name: name === "all" ? null : name,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    // If function doesn't exist yet, return empty
    if (error.message.includes("function") || error.message.includes("does not exist")) {
      return NextResponse.json({
        jobs: [],
        total: 0,
        limit,
        offset,
        error: "pg-boss query function not available",
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get stats for total count
  const { data: stats } = await supabase.rpc("get_pgboss_stats");

  return NextResponse.json({
    jobs: data || [],
    total: stats?.[0]?.total_jobs || data?.length || 0,
    stats: stats?.[0] || null,
    limit,
    offset,
  });
}
