import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST - Toggle worker pause state
 */
export async function POST() {
  const supabase = createAdminClient();

  try {
    // Get current state
    const { data: current, error: fetchError } = await supabase
      .from("worker_status")
      .select("is_paused")
      .eq("id", "main")
      .single();

    if (fetchError) {
      console.error("[toggle-pause] Failed to fetch worker status:", fetchError);
      return NextResponse.json(
        { error: `Failed to fetch worker status: ${fetchError.message}` },
        { status: 500 }
      );
    }

    const newPausedState = !current?.is_paused;

    // Update state
    const { error: updateError } = await supabase
      .from("worker_status")
      .update({ is_paused: newPausedState, updated_at: new Date().toISOString() })
      .eq("id", "main");

    if (updateError) {
      console.error("[toggle-pause] Failed to update worker status:", updateError);
      return NextResponse.json(
        { error: `Failed to update worker status: ${updateError.message}` },
        { status: 500 }
      );
    }

    console.log(`[toggle-pause] Worker ${newPausedState ? "paused" : "resumed"}`);

    return NextResponse.json({
      success: true,
      isPaused: newPausedState,
      message: newPausedState ? "Worker paused" : "Worker resumed",
    });
  } catch (err) {
    console.error("[toggle-pause] Unexpected error:", err);
    return NextResponse.json(
      { error: `Unexpected error: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
