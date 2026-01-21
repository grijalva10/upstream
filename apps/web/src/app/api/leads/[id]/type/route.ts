import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_TYPES = ["seller", "buyer", "buyer_seller", "broker", "other"];

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: leadId } = await params;
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { lead_type } = body;

    if (!lead_type || !VALID_TYPES.includes(lead_type)) {
      return NextResponse.json(
        { error: "Invalid lead type" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("leads")
      .update({ lead_type })
      .eq("id", leadId);

    if (error) {
      console.error("Error updating lead type:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, lead_type });
  } catch (error) {
    console.error("Error in PATCH /api/leads/[id]/type:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
