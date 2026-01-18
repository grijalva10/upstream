import { NextResponse } from "next/server";
import { COSTAR_SERVICE_URL } from "@/lib/constants";

export async function POST() {
  try {
    const res = await fetch(`${COSTAR_SERVICE_URL}/stop`, {
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
      { error: "CoStar service not running" },
      { status: 503 }
    );
  }
}
