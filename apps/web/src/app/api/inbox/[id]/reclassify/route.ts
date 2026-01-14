import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { classification } = await request.json();

    if (!classification) {
      return NextResponse.json(
        { error: "Classification is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Update the email classification
    const { error } = await supabase
      .from("synced_emails")
      .update({
        classification,
        classification_confidence: 1.0, // Human override = full confidence
        needs_human_review: false,
        classified_at: new Date().toISOString(),
        classified_by: "human",
      })
      .eq("id", id);

    if (error) {
      console.error("Reclassify error:", error);
      return NextResponse.json(
        { error: "Failed to update classification" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reclassify error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
