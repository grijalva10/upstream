import { NextResponse } from "next/server";

const COSTAR_SERVICE_URL = process.env.COSTAR_SERVICE_URL || "http://localhost:8765";

export async function GET() {
  try {
    const res = await fetch(`${COSTAR_SERVICE_URL}/status`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({
        status: "offline",
        error: "Service not responding",
        session_valid: false,
        expires_in_minutes: 0,
      });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    // Service not running
    return NextResponse.json({
      status: "offline",
      error: "Service not running",
      session_valid: false,
      expires_in_minutes: 0,
      started_at: null,
      last_activity: null,
      last_auth: null,
      queries_run: 0,
    });
  }
}
