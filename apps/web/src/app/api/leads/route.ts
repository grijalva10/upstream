import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { leadName, contactName, email, phone } = body;

    if (!leadName) {
      return NextResponse.json(
        { error: "Lead name is required" },
        { status: 400 }
      );
    }

    // Create the lead
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        name: leadName,
        status: "new",
        source: "manual",
      })
      .select()
      .single();

    if (leadError) {
      console.error("Error creating lead:", leadError);
      return NextResponse.json({ error: leadError.message }, { status: 500 });
    }

    // Create contact if contact name is provided
    let contact = null;
    if (contactName) {
      const { data: contactData, error: contactError } = await supabase
        .from("contacts")
        .insert({
          lead_id: lead.id,
          name: contactName,
          email: email || null,
          phone: phone || null,
          status: "active",
          source: "manual",
        })
        .select()
        .single();

      if (contactError) {
        console.error("Error creating contact:", contactError);
        // Don't fail the whole request, lead is already created
      } else {
        contact = contactData;
      }
    }

    return NextResponse.json({ lead, contact }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/leads:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
