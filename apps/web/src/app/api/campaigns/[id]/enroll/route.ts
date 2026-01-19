import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/campaigns/[id]/enroll
 * Bulk enroll all contacts from the campaign's search
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: campaignId } = await params;
    const supabase = createAdminClient();

    // Get campaign and its search
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, search_id, status")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.status !== "draft") {
      return NextResponse.json(
        { error: "Can only enroll contacts when campaign is in draft status" },
        { status: 400 }
      );
    }

    // Get all contacts from the search's properties
    // Join: search_properties → property_leads (owners) → contacts
    const { data: contactsData, error: contactsError } = await supabase
      .from("search_properties")
      .select(`
        property_id,
        properties!inner (
          property_leads!inner (
            lead_id,
            relationship,
            leads!inner (
              contacts!inner (
                id,
                email,
                status
              )
            )
          )
        )
      `)
      .eq("search_id", campaign.search_id);

    if (contactsError) {
      console.error("Error fetching contacts:", contactsError);
      return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
    }

    // Flatten and dedupe contacts, keeping track of which property they're for
    const enrollmentMap = new Map<string, { contact_id: string; property_id: string }>();

    for (const sp of contactsData || []) {
      const propertyId = sp.property_id;
      const properties = sp.properties as any;

      if (!properties?.property_leads) continue;

      for (const pl of properties.property_leads) {
        // Only include owners
        if (pl.relationship !== "owner") continue;

        const contacts = pl.leads?.contacts || [];
        for (const contact of contacts) {
          // Only active contacts with email
          if (contact.status !== "active" || !contact.email) continue;

          // Use contact_id as key to dedupe (one enrollment per contact)
          // Keep the first property we see for this contact
          if (!enrollmentMap.has(contact.id)) {
            enrollmentMap.set(contact.id, {
              contact_id: contact.id,
              property_id: propertyId,
            });
          }
        }
      }
    }

    const enrollments = Array.from(enrollmentMap.values());

    if (enrollments.length === 0) {
      return NextResponse.json({
        enrolled: 0,
        message: "No eligible contacts found"
      });
    }

    // Check for existing enrollments to avoid duplicates
    const { data: existing } = await supabase
      .from("enrollments")
      .select("contact_id")
      .eq("campaign_id", campaignId);

    const existingContactIds = new Set((existing || []).map((e) => e.contact_id));
    const newEnrollments = enrollments.filter((e) => !existingContactIds.has(e.contact_id));

    if (newEnrollments.length === 0) {
      return NextResponse.json({
        enrolled: 0,
        skipped: enrollments.length,
        message: "All contacts already enrolled"
      });
    }

    // Insert enrollments
    const { error: insertError } = await supabase
      .from("enrollments")
      .insert(
        newEnrollments.map((e) => ({
          campaign_id: campaignId,
          contact_id: e.contact_id,
          property_id: e.property_id,
          status: "pending",
          current_step: 0,
        }))
      );

    if (insertError) {
      console.error("Error inserting enrollments:", insertError);
      return NextResponse.json({ error: "Failed to create enrollments" }, { status: 500 });
    }

    // Update campaign totals
    await supabase
      .from("campaigns")
      .update({ total_enrolled: (existing?.length || 0) + newEnrollments.length })
      .eq("id", campaignId);

    return NextResponse.json({
      enrolled: newEnrollments.length,
      skipped: enrollments.length - newEnrollments.length,
      total: (existing?.length || 0) + newEnrollments.length,
      message: `Enrolled ${newEnrollments.length} contacts`,
    });
  } catch (error) {
    console.error("Enroll error:", error);
    return NextResponse.json({ error: "Failed to enroll contacts" }, { status: 500 });
  }
}
