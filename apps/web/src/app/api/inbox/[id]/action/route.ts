import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ActionType =
  | "create_deal"
  | "schedule_call"
  | "add_dnc"
  | "add_bounce"
  | "create_search"
  | "mark_reviewed"
  | "archive";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { action } = (await request.json()) as { action: ActionType };

    if (!action) {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get the inbox message first
    const { data: message, error: fetchError } = await supabase
      .from("synced_emails")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !message) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      );
    }

    let actionTaken: string = action;
    let createdId: string | null = null;

    switch (action) {
      case "create_deal": {
        if (!message.matched_property_id) {
          return NextResponse.json(
            { error: "No property linked to this message" },
            { status: 400 }
          );
        }

        // Check if deal already exists for this property
        const { data: existingDeal } = await supabase
          .from("deals")
          .select("id")
          .eq("property_id", message.matched_property_id)
          .single();

        if (existingDeal) {
          return NextResponse.json(
            { error: "Deal already exists for this property", dealId: existingDeal.id },
            { status: 409 }
          );
        }

        // Create new deal
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
          return NextResponse.json(
            { error: "Failed to create deal" },
            { status: 500 }
          );
        }

        createdId = deal.id;
        actionTaken = `created_deal:${deal.display_id}`;
        break;
      }

      case "schedule_call": {
        if (!message.matched_contact_id) {
          return NextResponse.json(
            { error: "No contact linked to this message" },
            { status: 400 }
          );
        }

        // Get or create deal for this property if exists
        let dealId: string | null = null;
        if (message.matched_property_id) {
          const { data: existingDeal } = await supabase
            .from("deals")
            .select("id")
            .eq("property_id", message.matched_property_id)
            .single();
          dealId = existingDeal?.id || null;
        }

        // Create call scheduled for tomorrow at 10am
        const scheduledAt = new Date();
        scheduledAt.setDate(scheduledAt.getDate() + 1);
        scheduledAt.setHours(10, 0, 0, 0);

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
          console.error("Create call error:", callError);
          return NextResponse.json(
            { error: "Failed to schedule call" },
            { status: 500 }
          );
        }

        createdId = call.id;
        actionTaken = `scheduled_call:${call.id}`;
        break;
      }

      case "add_dnc": {
        // Add email to exclusions
        const { error: exclusionError } = await supabase
          .from("exclusions")
          .upsert({
            exclusion_type: "email",
            value: message.from_email,
            reason: "dnc",
            source_message_id: message.id,
          }, {
            onConflict: "exclusion_type,value",
          });

        if (exclusionError) {
          console.error("Add DNC error:", exclusionError);
          return NextResponse.json(
            { error: "Failed to add to DNC" },
            { status: 500 }
          );
        }

        actionTaken = "added_to_dnc";
        break;
      }

      case "add_bounce": {
        // Add email to exclusions as bounce
        const { error: exclusionError } = await supabase
          .from("exclusions")
          .upsert({
            exclusion_type: "email",
            value: message.from_email,
            reason: "bounce",
            source_message_id: message.id,
          }, {
            onConflict: "exclusion_type,value",
          });

        if (exclusionError) {
          console.error("Add bounce error:", exclusionError);
          return NextResponse.json(
            { error: "Failed to add bounce" },
            { status: 500 }
          );
        }

        actionTaken = "marked_as_bounce";
        break;
      }

      case "create_search": {
        // Create inbound search from buyer inquiry
        const { data: search, error: searchError } = await supabase
          .from("searches")
          .insert({
            name: `Inbound - ${message.from_name || message.from_email}`,
            source: "inbound",
            source_contact_id: message.matched_contact_id,
            criteria_json: {
              source_message_id: message.id,
              notes: "Created from inbox reply - needs criteria capture",
            },
            status: "pending_queries",
          })
          .select("id")
          .single();

        if (searchError) {
          console.error("Create search error:", searchError);
          return NextResponse.json(
            { error: "Failed to create search" },
            { status: 500 }
          );
        }

        createdId = search.id;
        actionTaken = `created_search:${search.id}`;
        break;
      }

      case "mark_reviewed": {
        actionTaken = "marked_reviewed";
        break;
      }

      case "archive": {
        actionTaken = "archived";
        break;
      }

      default:
        return NextResponse.json(
          { error: "Unknown action" },
          { status: 400 }
        );
    }

    // Update the message status
    const newStatus = action === "mark_reviewed" ? "reviewed" : "actioned";
    const { error: updateError } = await supabase
      .from("synced_emails")
      .update({
        status: newStatus,
        action_taken: actionTaken,
      })
      .eq("id", id);

    if (updateError) {
      console.error("Update message error:", updateError);
      return NextResponse.json(
        { error: "Failed to update message status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      action: actionTaken,
      createdId,
    });
  } catch (error) {
    console.error("Action error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
