import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface SuggestedAction {
  type: string;
  label: string;
  data: Record<string, unknown>;
  confirmed: boolean;
}

interface ExecuteActionRequest {
  action: SuggestedAction;
}

export async function POST(request: Request) {
  try {
    const body: ExecuteActionRequest = await request.json();
    const { action } = body;

    if (!action || !action.type) {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    switch (action.type) {
      case "create_contact": {
        const data = action.data;

        // First, check if we need to create or find a lead
        let leadId: string | null = null;
        if (data.company_name) {
          // Check if lead exists
          const { data: existingLead } = await supabase
            .from("leads")
            .select("id")
            .eq("name", data.company_name)
            .maybeSingle();

          if (existingLead) {
            leadId = existingLead.id;
          } else {
            // Create the lead
            const { data: newLead, error: leadError } = await supabase
              .from("leads")
              .insert({
                name: data.company_name as string,
                status: "new",
              })
              .select("id")
              .single();

            if (leadError) {
              console.error("Error creating lead:", leadError);
            } else {
              leadId = newLead.id;
            }
          }
        }

        // Create the contact
        const { data: contact, error: contactError } = await supabase
          .from("contacts")
          .insert({
            first_name: data.first_name as string || null,
            last_name: data.last_name as string || null,
            email: data.email as string || null,
            phone: data.phone as string || null,
            role: data.role as string || null,
            type: data.type as string || "seller",
            lead_id: leadId,
            status: "active",
          })
          .select("*")
          .single();

        if (contactError) {
          console.error("Error creating contact:", contactError);
          return NextResponse.json(
            { error: `Failed to create contact: ${contactError.message}` },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: `Created contact: ${contact.first_name} ${contact.last_name}`,
          data: contact,
        });
      }

      case "create_search": {
        const data = action.data;

        const { data: search, error: searchError } = await supabase
          .from("searches")
          .insert({
            name: data.name as string || "New Search",
            status: "new",
            criteria_json: data.criteria || {
              property_type: data.property_type,
              market: data.market,
              budget: data.budget,
            },
          })
          .select("*")
          .single();

        if (searchError) {
          console.error("Error creating search:", searchError);
          return NextResponse.json(
            { error: `Failed to create search: ${searchError.message}` },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: `Created search: ${search.name}`,
          data: search,
        });
      }

      case "create_task": {
        const data = action.data;

        const { data: task, error: taskError } = await supabase
          .from("tasks")
          .insert({
            title: data.title as string,
            due_at: data.due_date as string || null,
            contact_id: data.contact_id as string || null,
            status: "pending",
            type: "follow_up",
          })
          .select("*")
          .single();

        if (taskError) {
          console.error("Error creating task:", taskError);
          return NextResponse.json(
            { error: `Failed to create task: ${taskError.message}` },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: `Created task: ${task.title}`,
          data: task,
        });
      }

      case "update_contact": {
        const data = action.data;
        const contactId = data.contact_id as string;
        const updates = data.updates as Record<string, unknown>;

        if (!contactId) {
          return NextResponse.json(
            { error: "Contact ID is required for update" },
            { status: 400 }
          );
        }

        const { data: contact, error: updateError } = await supabase
          .from("contacts")
          .update(updates)
          .eq("id", contactId)
          .select("*")
          .single();

        if (updateError) {
          console.error("Error updating contact:", updateError);
          return NextResponse.json(
            { error: `Failed to update contact: ${updateError.message}` },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: `Updated contact successfully`,
          data: contact,
        });
      }

      case "mark_dnc": {
        const data = action.data;
        const contactId = data.contact_id as string;

        if (!contactId) {
          return NextResponse.json(
            { error: "Contact ID is required for DNC" },
            { status: 400 }
          );
        }

        // Get the contact to get their email
        const { data: contact, error: fetchError } = await supabase
          .from("contacts")
          .select("email")
          .eq("id", contactId)
          .single();

        if (fetchError || !contact) {
          return NextResponse.json(
            { error: "Contact not found" },
            { status: 404 }
          );
        }

        // Update contact status
        const { error: updateError } = await supabase
          .from("contacts")
          .update({ status: "dnc" })
          .eq("id", contactId);

        if (updateError) {
          console.error("Error marking contact as DNC:", updateError);
          return NextResponse.json(
            { error: `Failed to mark contact as DNC: ${updateError.message}` },
            { status: 500 }
          );
        }

        // Add to exclusions if email exists
        if (contact.email) {
          await supabase
            .from("exclusions")
            .upsert({
              exclusion_type: "email",
              value: contact.email.toLowerCase(),
              reason: "dnc",
            }, { onConflict: "exclusion_type,value" });
        }

        return NextResponse.json({
          success: true,
          message: "Contact marked as Do Not Contact",
        });
      }

      case "send_email": {
        // For now, we'll create a draft instead of sending directly
        const data = action.data;

        const { data: draft, error: draftError } = await supabase
          .from("email_drafts")
          .insert({
            to_email: data.to as string,
            subject: data.subject as string,
            body: data.body as string,
            status: "pending_approval",
          })
          .select("*")
          .single();

        if (draftError) {
          console.error("Error creating email draft:", draftError);
          return NextResponse.json(
            { error: `Failed to create email draft: ${draftError.message}` },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: `Email draft created. Go to Approvals to review and send.`,
          data: draft,
        });
      }

      case "create_deal": {
        const data = action.data;

        const { data: deal, error: dealError } = await supabase
          .from("deals")
          .insert({
            property_id: data.property_id as string || null,
            contact_id: data.contact_id as string || null,
            status: data.status as string || "new",
          })
          .select("*")
          .single();

        if (dealError) {
          console.error("Error creating deal:", dealError);
          return NextResponse.json(
            { error: `Failed to create deal: ${dealError.message}` },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: `Created new deal`,
          data: deal,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action type: ${action.type}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Execute action error:", error);
    return NextResponse.json(
      { error: "Failed to execute action" },
      { status: 500 }
    );
  }
}
