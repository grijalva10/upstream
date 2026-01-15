import { NextResponse } from "next/server";

const COSTAR_SERVICE_URL = process.env.COSTAR_SERVICE_URL || "http://localhost:8765";

export async function POST() {
  try {
    const res = await fetch(`${COSTAR_SERVICE_URL}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "CoStar service not running. Start it with: python integrations/costar/service.py" },
      { status: 503 }
    );
  }
}
