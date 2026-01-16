import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const WORKER_SETTINGS_KEYS = [
  "worker.rate_limit_hourly",
  "worker.rate_limit_daily",
  "worker.default_timezone",
  "worker.interval_email_sync",
  "worker.interval_check_replies",
  "worker.interval_queue_process",
  "worker.dry_run",
  "worker.debug",
  "worker.paused",
];

const DEFAULTS: Record<string, string | number | boolean> = {
  "worker.rate_limit_hourly": 1000,
  "worker.rate_limit_daily": 10000,
  "worker.default_timezone": "America/Los_Angeles",
  "worker.interval_email_sync": 15,
  "worker.interval_check_replies": 5,
  "worker.interval_queue_process": 30,
  "worker.dry_run": true, // Default to disabled - emails logged but not sent
  "worker.debug": false,
  "worker.paused": false,
};

export async function GET() {
  const supabase = createAdminClient();

  // Fetch all worker settings
  const { data, error } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", WORKER_SETTINGS_KEYS);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build settings object with defaults
  const settings: Record<string, unknown> = { ...DEFAULTS };

  for (const { key, value } of data || []) {
    try {
      settings[key] = JSON.parse(value);
    } catch {
      settings[key] = value;
    }
  }

  // Also get worker status
  const { data: worker } = await supabase
    .from("worker_status")
    .select("*")
    .eq("id", "main")
    .single();

  // Get rate check
  const { data: rateCheck } = await supabase.rpc("check_send_rate_limit", {
    p_group: "default",
    p_hourly_limit: settings["worker.rate_limit_hourly"] as number,
    p_daily_limit: settings["worker.rate_limit_daily"] as number,
  });

  return NextResponse.json({
    settings,
    worker: worker || null,
    rateStatus: rateCheck?.[0] || null,
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = createAdminClient();
  const body = await request.json();

  const updates: { key: string; value: string }[] = [];

  for (const [key, value] of Object.entries(body)) {
    if (!WORKER_SETTINGS_KEYS.includes(key)) {
      return NextResponse.json(
        { error: `Invalid setting key: ${key}` },
        { status: 400 }
      );
    }

    // Validate types
    if (key.includes("rate_limit") || key.includes("interval")) {
      const num = parseInt(String(value));
      if (isNaN(num) || num < 0) {
        return NextResponse.json(
          { error: `${key} must be a positive number` },
          { status: 400 }
        );
      }
      updates.push({ key, value: String(num) });
    } else if (key.includes("dry_run") || key.includes("debug") || key.includes("paused")) {
      updates.push({ key, value: String(value === true || value === "true") });
    } else {
      updates.push({ key, value: JSON.stringify(value) });
    }
  }

  // Upsert settings
  for (const { key, value } of updates) {
    const { error } = await supabase
      .from("settings")
      .upsert({ key, value }, { onConflict: "key" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    message: "Settings updated. Worker will reload within 60 seconds.",
  });
}
