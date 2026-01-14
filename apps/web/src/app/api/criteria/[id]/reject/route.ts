import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get current criteria to verify status
    const { data: criteria, error: fetchError } = await supabase
      .from("client_criteria")
      .select("id, status")
      .eq("id", id)
      .single();

    if (fetchError || !criteria) {
      return NextResponse.json(
        { error: "Criteria not found" },
        { status: 404 }
      );
    }

    if (criteria.status !== "pending_approval") {
      return NextResponse.json(
        { error: `Cannot reject criteria with status: ${criteria.status}` },
        { status: 400 }
      );
    }

    // Update status to draft (allows re-editing)
    const { error: updateError } = await supabase
      .from("client_criteria")
      .update({ status: "draft" })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating criteria status:", updateError);
      return NextResponse.json(
        { error: "Failed to update criteria status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "rejected",
      message: "Criteria rejected. Status set to draft for revision.",
      criteriaId: id,
    });
  } catch (error) {
    console.error("Reject criteria error:", error);
    return NextResponse.json(
      { error: "Failed to reject criteria: " + (error as Error).message },
      { status: 500 }
    );
  }
}
