import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ContactPreview {
  contact_id: string;
  contact_name: string;
  email: string;
  lead_id: string;
  lead_name: string;
  property_address: string | null;
}

interface ExcludedContact extends ContactPreview {
  reason: string;
}

interface PreviewResponse {
  campaign: {
    id: string;
    name: string;
    status: string;
  };
  will_enroll: ContactPreview[];
  excluded: ExcludedContact[];
  schedule: {
    emails_per_day: number;
    send_window: string;
    estimated_days: number;
    note: string;
  };
  summary: {
    total_contacts: number;
    will_enroll: number;
    excluded: number;
  };
}

/**
 * GET /api/campaigns/[id]/preview
 * Preview who will be enrolled and who will be excluded (with reasons)
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: campaignId } = await params;
    const supabase = createAdminClient();

    // Get campaign and its search
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, name, status, search_id")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Get all contacts from the search's properties (same logic as enroll)
    const { data: contactsData, error: contactsError } = await supabase
      .from("search_properties")
      .select(`
        property_id,
        properties!inner (
          address,
          property_leads!inner (
            lead_id,
            relationship,
            leads!inner (
              id,
              name,
              contacts!inner (
                id,
                name,
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

    // Get DNC list
    const { data: dncList } = await supabase
      .from("dnc_entries")
      .select("email");
    const dncEmails = new Set((dncList || []).map(d => d.email?.toLowerCase()));

    // Get exclusions (bounces)
    const { data: exclusionsList } = await supabase
      .from("email_exclusions")
      .select("email, reason");
    const exclusions = new Map((exclusionsList || []).map(e => [e.email?.toLowerCase(), e.reason]));

    // Get existing enrollments in ANY active campaign
    const { data: existingEnrollments } = await supabase
      .from("enrollments")
      .select(`
        contact_id,
        campaigns!inner (id, name, status)
      `)
      .in("status", ["pending", "active"]);

    // Map contact_id to campaign name they're in
    const enrolledInCampaign = new Map<string, string>();
    for (const e of existingEnrollments || []) {
      const c = e.campaigns as any;
      if (c && c.status === "active" && c.id !== campaignId) {
        enrolledInCampaign.set(e.contact_id, c.name);
      }
    }

    // Get contacts already enrolled in THIS campaign
    const { data: thisEnrollments } = await supabase
      .from("enrollments")
      .select("contact_id")
      .eq("campaign_id", campaignId);
    const alreadyInThisCampaign = new Set((thisEnrollments || []).map(e => e.contact_id));

    // Process contacts
    const willEnroll: ContactPreview[] = [];
    const excluded: ExcludedContact[] = [];
    const seenContactIds = new Set<string>();

    for (const sp of contactsData || []) {
      const propertyId = sp.property_id;
      const properties = sp.properties as any;
      const propertyAddress = properties?.address || null;

      if (!properties?.property_leads) continue;

      for (const pl of properties.property_leads) {
        // Only include owners
        if (pl.relationship !== "owner") continue;

        const lead = pl.leads;
        if (!lead) continue;

        const contacts = lead.contacts || [];
        for (const contact of contacts) {
          // Skip duplicates
          if (seenContactIds.has(contact.id)) continue;
          seenContactIds.add(contact.id);

          const emailLower = contact.email?.toLowerCase();
          const contactInfo: ContactPreview = {
            contact_id: contact.id,
            contact_name: contact.name || "Unknown",
            email: contact.email || "",
            lead_id: lead.id,
            lead_name: lead.name || "Unknown",
            property_address: propertyAddress,
          };

          // Check exclusion reasons (in priority order)
          if (!contact.email) {
            excluded.push({ ...contactInfo, reason: "No email address" });
          } else if (contact.status === "bounced") {
            excluded.push({ ...contactInfo, reason: "Email bounced" });
          } else if (contact.status === "dnc") {
            excluded.push({ ...contactInfo, reason: "Marked as Do Not Contact" });
          } else if (contact.status === "unsubscribed") {
            excluded.push({ ...contactInfo, reason: "Unsubscribed" });
          } else if (contact.status !== "active") {
            excluded.push({ ...contactInfo, reason: `Contact status: ${contact.status}` });
          } else if (dncEmails.has(emailLower)) {
            excluded.push({ ...contactInfo, reason: "On DNC list" });
          } else if (exclusions.has(emailLower)) {
            excluded.push({ ...contactInfo, reason: `Excluded: ${exclusions.get(emailLower)}` });
          } else if (alreadyInThisCampaign.has(contact.id)) {
            excluded.push({ ...contactInfo, reason: "Already enrolled in this campaign" });
          } else if (enrolledInCampaign.has(contact.id)) {
            excluded.push({ ...contactInfo, reason: `Already in active campaign: ${enrolledInCampaign.get(contact.id)}` });
          } else {
            willEnroll.push(contactInfo);
          }
        }
      }
    }

    // Calculate schedule estimate
    const emailsPerDay = 50; // Could be configurable
    const totalEmails = willEnroll.length * 3; // 3-email sequence
    const estimatedDays = Math.ceil(totalEmails / emailsPerDay);

    const response: PreviewResponse = {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
      },
      will_enroll: willEnroll,
      excluded: excluded,
      schedule: {
        emails_per_day: emailsPerDay,
        send_window: "9:00 AM - 5:00 PM (weekdays)",
        estimated_days: estimatedDays,
        note: `${willEnroll.length} contacts × 3 emails = ${totalEmails} total emails`,
      },
      summary: {
        total_contacts: willEnroll.length + excluded.length,
        will_enroll: willEnroll.length,
        excluded: excluded.length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Preview error:", error);
    return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
  }
}
