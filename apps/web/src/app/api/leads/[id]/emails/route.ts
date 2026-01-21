import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: leadId } = await params;
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { contactId, subject, emailBody } = body;

    if (!contactId) {
      return NextResponse.json(
        { error: "Contact is required" },
        { status: 400 }
      );
    }

    if (!subject?.trim()) {
      return NextResponse.json(
        { error: "Subject is required" },
        { status: 400 }
      );
    }

    if (!emailBody?.trim()) {
      return NextResponse.json(
        { error: "Email body is required" },
        { status: 400 }
      );
    }

    // Get contact details
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id, name, email, lead_id")
      .eq("id", contactId)
      .single();

    if (contactError || !contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    if (!contact.email) {
      return NextResponse.json(
        { error: "Contact has no email address" },
        { status: 400 }
      );
    }

    // Verify contact belongs to this lead
    if (contact.lead_id !== leadId) {
      return NextResponse.json(
        { error: "Contact does not belong to this lead" },
        { status: 400 }
      );
    }

    // Create email draft for sending
    const { data: draft, error } = await supabase
      .from("email_drafts")
      .insert({
        to_email: contact.email,
        to_name: contact.name,
        subject: subject.trim(),
        body: emailBody.trim(),
        lead_id: leadId,
        contact_id: contactId,
        draft_type: "follow_up",
        status: "pending",
        generated_by: "human",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating email draft:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/leads/[id]/emails:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
