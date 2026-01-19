"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  type Action,
  type Classification,
  actionSchema,
  classificationSchema,
  replyRequestSchema,
} from "@/lib/inbox/schemas";

// =============================================================================
// Types
// =============================================================================

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// =============================================================================
// Reclassify Message
// =============================================================================

export async function reclassifyMessage(
  messageId: string,
  classification: Classification
): Promise<ActionResult> {
  const parsed = classificationSchema.safeParse(classification);
  if (!parsed.success) {
    return { success: false, error: "Invalid classification" };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("synced_emails")
    .update({
      classification: parsed.data,
      classification_confidence: 1.0,
      classification_reasoning: "Manually reclassified by user",
      status: "reviewed",
    })
    .eq("id", messageId);

  if (error) {
    console.error("Reclassify error:", error);
    return { success: false, error: "Failed to update classification" };
  }

  revalidatePath("/inbox");
  return { success: true };
}

// =============================================================================
// Take Action on Message
// =============================================================================

export async function takeAction(
  messageId: string,
  action: Action
): Promise<ActionResult<{ createdId?: string }>> {
  const parsed = actionSchema.safeParse(action);
  if (!parsed.success) {
    return { success: false, error: "Invalid action" };
  }

  const supabase = await createClient();

  // Fetch message
  const { data: message, error: fetchError } = await supabase
    .from("synced_emails")
    .select("*")
    .eq("id", messageId)
    .single();

  if (fetchError || !message) {
    return { success: false, error: "Message not found" };
  }

  let actionTaken: string = parsed.data;
  let createdId: string | undefined;

  switch (parsed.data) {
    case "create_deal": {
      if (!message.matched_property_id) {
        return { success: false, error: "No property linked to this message" };
      }

      // Check for existing deal
      const { data: existing } = await supabase
        .from("deals")
        .select("id, display_id")
        .eq("property_id", message.matched_property_id)
        .single();

      if (existing) {
        return { success: false, error: `Deal ${existing.display_id} already exists` };
      }

      const { data: deal, error: dealError } = await supabase
        .from("deals")
        .insert({
          property_id: message.matched_property_id,
          contact_id: message.matched_contact_id,
          enrollment_id: message.enrollment_id,
          status: "qualifying",
        })
        .select("id, display_id")
        .single();

      if (dealError) {
        console.error("Create deal error:", dealError);
        return { success: false, error: "Failed to create deal" };
      }

      createdId = deal.id;
      actionTaken = `created_deal:${deal.display_id}`;
      break;
    }

    case "schedule_call": {
      if (!message.matched_contact_id) {
        return { success: false, error: "No contact linked to this message" };
      }

      // Find deal if exists
      let dealId: string | null = null;
      if (message.matched_property_id) {
        const { data: deal } = await supabase
          .from("deals")
          .select("id")
          .eq("property_id", message.matched_property_id)
          .single();
        dealId = deal?.id || null;
      }

      // Schedule for next business day at 10am PT
      const scheduledAt = getNextBusinessDay();

      const { data: call, error: callError } = await supabase
        .from("calls")
        .insert({
          contact_id: message.matched_contact_id,
          deal_id: dealId,
          scheduled_at: scheduledAt.toISOString(),
          status: "scheduled",
        })
        .select("id")
        .single();

      if (callError) {
        console.error("Schedule call error:", callError);
        return { success: false, error: "Failed to schedule call" };
      }

      createdId = call.id;
      actionTaken = "call_scheduled";
      break;
    }

    case "create_search": {
      const { data: search, error: searchError } = await supabase
        .from("searches")
        .insert({
          name: `Inbound - ${message.from_name || message.from_email}`,
          source: "inbound",
          source_contact_id: message.matched_contact_id,
          criteria_json: { source_message_id: messageId },
          status: "pending_queries",
        })
        .select("id")
        .single();

      if (searchError) {
        console.error("Create search error:", searchError);
        return { success: false, error: "Failed to create search" };
      }

      createdId = search.id;
      actionTaken = "search_created";
      break;
    }

    case "confirm_dnc": {
      const { error } = await supabase.from("exclusions").upsert(
        {
          exclusion_type: "email",
          value: message.from_email,
          reason: "dnc",
          source_message_id: messageId,
        },
        { onConflict: "exclusion_type,value" }
      );

      if (error) {
        console.error("Add DNC error:", error);
        return { success: false, error: "Failed to add to DNC" };
      }

      actionTaken = "dnc_confirmed";
      break;
    }

    case "confirm_bounce": {
      const { error } = await supabase.from("exclusions").upsert(
        {
          exclusion_type: "email",
          value: message.from_email,
          reason: "bounce",
          source_message_id: messageId,
        },
        { onConflict: "exclusion_type,value" }
      );

      if (error) {
        console.error("Add bounce error:", error);
        return { success: false, error: "Failed to mark bounce" };
      }

      actionTaken = "bounce_confirmed";
      break;
    }

    case "archive":
      actionTaken = "archived";
      break;

    case "mark_reviewed":
      actionTaken = "reviewed";
      break;

    case "reply":
      // Reply is handled separately via the reply dialog
      return { success: true };

    case "approve_draft":
    case "edit_draft":
      // These are handled separately via dedicated functions
      return { success: true };

    case "create_contact": {
      // Create a new contact from the email sender
      const { data: newContact, error: contactError } = await supabase
        .from("contacts")
        .insert({
          name: message.from_name || message.from_email?.split("@")[0] || "Unknown",
          email: message.from_email,
          source: "inbound",
          contact_type: "seller",
          status: "active",
        })
        .select("id")
        .single();

      if (contactError) {
        console.error("Create contact error:", contactError);
        return { success: false, error: "Failed to create contact" };
      }

      // Link the contact to the email
      await supabase
        .from("synced_emails")
        .update({ matched_contact_id: newContact.id })
        .eq("id", messageId);

      createdId = newContact.id;
      actionTaken = "contact_created";
      break;
    }
  }

  // Update message status
  const newStatus = action === "mark_reviewed" ? "reviewed" : "actioned";
  const { error: updateError } = await supabase
    .from("synced_emails")
    .update({ status: newStatus, action_taken: actionTaken })
    .eq("id", messageId);

  if (updateError) {
    console.error("Update message error:", updateError);
    return { success: false, error: "Action completed but failed to update status" };
  }

  revalidatePath("/inbox");
  return { success: true, data: { createdId } };
}

// =============================================================================
// Queue Reply
// =============================================================================

export async function queueReply(
  messageId: string,
  subject: string,
  body: string
): Promise<ActionResult> {
  const parsed = replyRequestSchema.safeParse({ subject, body });
  if (!parsed.success) {
    return { success: false, error: "Subject and body are required" };
  }

  const supabase = await createClient();

  // Get message
  const { data: message, error: fetchError } = await supabase
    .from("synced_emails")
    .select("from_email, from_name, matched_contact_id")
    .eq("id", messageId)
    .single();

  if (fetchError || !message) {
    return { success: false, error: "Message not found" };
  }

  // Get lead from contact
  let leadId: string | null = null;
  if (message.matched_contact_id) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("lead_id")
      .eq("id", message.matched_contact_id)
      .single();
    leadId = contact?.lead_id || null;
  }

  const { error } = await supabase.from("email_drafts").insert({
    to_email: message.from_email,
    to_name: message.from_name,
    subject: parsed.data.subject,
    body: parsed.data.body,
    lead_id: leadId,
    contact_id: message.matched_contact_id,
    in_reply_to_email_id: messageId,
    draft_type: "qualification",
    status: "pending",
    generated_by: "human",
  });

  if (error) {
    console.error("Create draft error:", error);
    return { success: false, error: "Failed to queue reply" };
  }

  revalidatePath("/inbox");
  return { success: true };
}

// =============================================================================
// Helpers
// =============================================================================

function getNextBusinessDay(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);

  // Skip weekends
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }

  // Set to 10am PT (UTC-8 or UTC-7 depending on DST)
  date.setUTCHours(18, 0, 0, 0); // 10am PT = 18:00 UTC (winter)

  return date;
}

// =============================================================================
// Draft Actions
// =============================================================================

export async function approveDraft(draftId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("email_drafts")
    .update({ status: "approved" })
    .eq("id", draftId);

  if (error) {
    console.error("Approve draft error:", error);
    return { success: false, error: "Failed to approve draft" };
  }

  revalidatePath("/inbox");
  return { success: true };
}

export async function editDraft(
  draftId: string,
  subject: string,
  body: string
): Promise<ActionResult> {
  const parsed = replyRequestSchema.safeParse({ subject, body });
  if (!parsed.success) {
    return { success: false, error: "Subject and body are required" };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("email_drafts")
    .update({
      subject: parsed.data.subject,
      body: parsed.data.body,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draftId);

  if (error) {
    console.error("Edit draft error:", error);
    return { success: false, error: "Failed to edit draft" };
  }

  revalidatePath("/inbox");
  return { success: true };
}

// =============================================================================
// Contact Actions
// =============================================================================

export async function createContactFromEmail(
  messageId: string,
  name?: string
): Promise<ActionResult<{ contactId: string }>> {
  const supabase = await createClient();

  // Get the email
  const { data: message, error: fetchError } = await supabase
    .from("synced_emails")
    .select("from_email, from_name, matched_contact_id")
    .eq("id", messageId)
    .single();

  if (fetchError || !message) {
    return { success: false, error: "Message not found" };
  }

  if (message.matched_contact_id) {
    return { success: false, error: "Contact already linked to this email" };
  }

  // Check if contact already exists with this email
  const { data: existing } = await supabase
    .from("contacts")
    .select("id")
    .eq("email", message.from_email)
    .single();

  if (existing) {
    // Link existing contact
    await supabase
      .from("synced_emails")
      .update({ matched_contact_id: existing.id })
      .eq("id", messageId);

    revalidatePath("/inbox");
    return { success: true, data: { contactId: existing.id } };
  }

  // Create new contact
  const contactName = name || message.from_name || message.from_email?.split("@")[0] || "Unknown";

  const { data: newContact, error: createError } = await supabase
    .from("contacts")
    .insert({
      name: contactName,
      email: message.from_email,
      source: "inbound",
      contact_type: "seller",
      status: "active",
    })
    .select("id")
    .single();

  if (createError) {
    console.error("Create contact error:", createError);
    return { success: false, error: "Failed to create contact" };
  }

  // Link to email
  await supabase
    .from("synced_emails")
    .update({ matched_contact_id: newContact.id })
    .eq("id", messageId);

  revalidatePath("/inbox");
  return { success: true, data: { contactId: newContact.id } };
}
