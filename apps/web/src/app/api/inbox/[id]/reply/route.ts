import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { body, subject } = await request.json();

    if (!body?.trim()) {
      return NextResponse.json(
        { error: "Reply body is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get the original email to extract context
    const { data: email, error: emailError } = await supabase
      .from("synced_emails")
      .select("from_email, from_name, matched_company_id, matched_contact_id")
      .eq("id", id)
      .single();

    if (emailError || !email) {
      return NextResponse.json(
        { error: "Email not found" },
        { status: 404 }
      );
    }

    // Create email draft for approval
    const { error: draftError } = await supabase.from("email_drafts").insert({
      to_email: email.from_email,
      to_name: email.from_name,
      subject: subject || "Re:",
      body: body.trim(),
      company_id: email.matched_company_id,
      contact_id: email.matched_contact_id,
      in_reply_to_email_id: id,
      draft_type: "qualification",
      status: "pending",
      generated_by: "human",
    });

    if (draftError) {
      console.error("Create draft error:", draftError);
      return NextResponse.json(
        { error: "Failed to create draft" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reply error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
