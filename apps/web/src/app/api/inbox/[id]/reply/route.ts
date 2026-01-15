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

    // Get the original message to extract context
    const { data: message, error: messageError } = await supabase
      .from("inbox_messages")
      .select("from_email, from_name, contact_id, property_id, enrollment_id")
      .eq("id", id)
      .single();

    if (messageError || !message) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      );
    }

    // Get company_id from contact if available
    let companyId: string | null = null;
    if (message.contact_id) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("company_id")
        .eq("id", message.contact_id)
        .single();
      companyId = contact?.company_id || null;
    }

    // Create email draft for approval
    const { error: draftError } = await supabase.from("email_drafts").insert({
      to_email: message.from_email,
      to_name: message.from_name,
      subject: subject || "Re:",
      body: body.trim(),
      company_id: companyId,
      contact_id: message.contact_id,
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
