import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - Fetch draft with full context
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = createAdminClient();

  const { data: draft, error } = await supabase
    .from("email_drafts")
    .select(`
      *,
      contacts (id, name, email, phone),
      leads (id, name, status),
      properties (id, address, property_type, building_size_sqft)
    `)
    .eq("id", id)
    .single();

  if (error || !draft) {
    return NextResponse.json(
      { error: "Draft not found" },
      { status: 404 }
    );
  }

  // Get the source email thread if this is a reply
  let thread: any[] = [];
  if (draft.source_email_id) {
    const { data: sourceEmail } = await supabase
      .from("synced_emails")
      .select("outlook_conversation_id")
      .eq("id", draft.source_email_id)
      .single();

    if (sourceEmail?.outlook_conversation_id) {
      const { data: threadEmails } = await supabase
        .from("synced_emails")
        .select("id, from_email, from_name, subject, body_text, direction, received_at")
        .eq("outlook_conversation_id", sourceEmail.outlook_conversation_id)
        .order("received_at", { ascending: true })
        .limit(10);

      thread = threadEmails || [];
    }
  }

  return NextResponse.json({
    ...draft,
    thread,
  });
}

// PATCH - Update draft content
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = createAdminClient();

  const body = await request.json();
  const { subject, body: draftBody } = body;

  // Get the draft first
  const { data: draft, error: fetchError } = await supabase
    .from("email_drafts")
    .select("status")
    .eq("id", id)
    .single();

  if (fetchError || !draft) {
    return NextResponse.json(
      { error: "Draft not found" },
      { status: 404 }
    );
  }

  if (draft.status !== "pending") {
    return NextResponse.json(
      { error: `Cannot edit a ${draft.status} draft` },
      { status: 400 }
    );
  }

  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (subject !== undefined) updates.subject = subject;
  if (draftBody !== undefined) updates.body = draftBody;

  const { data: updated, error: updateError } = await supabase
    .from("email_drafts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update draft" },
      { status: 500 }
    );
  }

  return NextResponse.json(updated);
}
