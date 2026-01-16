import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ContactData {
  id: string;
  name: string | null;
  email: string | null;
}

interface PropertyData {
  id: string;
  address: string | null;
  city: string | null;
  state_code: string | null;
  property_type: string | null;
  building_size_sqft: number | null;
  year_built: number | null;
  last_sale_date: string | null;
}

/**
 * Personalize email content by replacing merge tags with actual data
 */
function personalizeEmail(
  template: string,
  contact: ContactData,
  property: PropertyData
): string {
  if (!template) return "";

  let result = template;

  // Extract first name
  const firstName = contact.name?.split(" ")[0] || "there";
  result = result.replace(/\{\{FirstName\}\}/gi, firstName);
  result = result.replace(/\{\{first_name\}\}/gi, firstName);

  // Property address (full) - support both {{PropertyAddress}} and {{property_address}}
  const fullAddress = [property.address, property.city, property.state_code]
    .filter(Boolean)
    .join(", ");
  result = result.replace(/\{\{PropertyAddress\}\}/g, fullAddress || "the property");
  result = result.replace(/\{\{property_address\}\}/gi, fullAddress || "the property");
  result = result.replace(/\{\{Address\}\}/g, property.address || "the property");
  result = result.replace(/\{\{address\}\}/gi, property.address || "the property");

  // Property type (lowercase mid-sentence)
  const propertyType = property.property_type?.toLowerCase() || "commercial";
  result = result.replace(/\{\{PropertyType\}\}/g, propertyType);
  result = result.replace(/\{\{property_type\}\}/gi, propertyType);

  // Building size (formatted with commas)
  const buildingSf = property.building_size_sqft;
  const sfDisplay = buildingSf ? `${buildingSf.toLocaleString()} SF` : "";
  result = result.replace(/\{\{BuildingSf\}\}/g, sfDisplay);
  result = result.replace(/\{\{building_sf\}\}/gi, sfDisplay);
  result = result.replace(/\{\{Size\}\}/g, sfDisplay);
  result = result.replace(/\{\{size\}\}/gi, sfDisplay);

  // Years held (calculated from last_sale_date)
  const currentYear = new Date().getFullYear();
  const lastSaleDate = property.last_sale_date;
  const yearAcquired = lastSaleDate ? new Date(lastSaleDate).getFullYear() : null;
  const yearsHeld = yearAcquired ? currentYear - yearAcquired : null;
  if (yearsHeld && yearsHeld > 0) {
    result = result.replace(/\{\{YearsHeld\}\}/g, String(yearsHeld));
    result = result.replace(/\{\{years_held\}\}/gi, String(yearsHeld));
  } else {
    result = result.replace(/for \{\{YearsHeld\}\} years?/g, "");
    result = result.replace(/for \{\{years_held\}\} years?/gi, "");
    result = result.replace(/\{\{YearsHeld\}\} years? of ownership/g, "");
    result = result.replace(/\{\{years_held\}\} years? of ownership/gi, "");
    result = result.replace(/\{\{YearsHeld\}\}/g, "");
    result = result.replace(/\{\{years_held\}\}/gi, "");
  }

  // Year built
  result = result.replace(/\{\{YearBuilt\}\}/g, String(property.year_built || ""));
  result = result.replace(/\{\{year_built\}\}/gi, String(property.year_built || ""));

  // City
  result = result.replace(/\{\{City\}\}/g, property.city || "");
  result = result.replace(/\{\{city\}\}/gi, property.city || "");

  // State
  result = result.replace(/\{\{State\}\}/g, property.state_code || "");
  result = result.replace(/\{\{state\}\}/gi, property.state_code || "");

  // Clean up any double spaces
  result = result.replace(/  +/g, " ");

  return result;
}

/**
 * POST /api/campaigns/[id]/send-test
 * Send test emails (all 3 in sequence) to a specified email address
 * Uses real contact/property data for personalization
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: campaignId } = await params;
    const body = await request.json().catch(() => ({}));
    const { testEmail, enrollmentId } = body;

    if (!testEmail) {
      return NextResponse.json(
        { error: "testEmail is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get campaign with email templates
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (!campaign.email_1_subject || !campaign.email_1_body) {
      return NextResponse.json(
        { error: "Campaign must have email templates before testing" },
        { status: 400 }
      );
    }

    // Get enrollment with contact and property data
    let enrollmentQuery = supabase
      .from("enrollments")
      .select(`
        id,
        contact_id,
        property_id,
        contact:contacts(id, name, email),
        property:properties(id, address, city, state_code, property_type, building_size_sqft, year_built, last_sale_date)
      `)
      .eq("campaign_id", campaignId);

    if (enrollmentId) {
      enrollmentQuery = enrollmentQuery.eq("id", enrollmentId);
    }

    const { data: enrollmentRows, error: enrollmentsError } = await enrollmentQuery
      .limit(1);

    if (enrollmentsError) {
      console.error("Enrollment query error:", enrollmentsError);
      return NextResponse.json(
        { error: "Failed to query enrollments" },
        { status: 500 }
      );
    }

    if (!enrollmentRows || enrollmentRows.length === 0) {
      return NextResponse.json(
        { error: "No enrollments found for this campaign" },
        { status: 400 }
      );
    }

    const enrollment = enrollmentRows[0];
    const contact = enrollment.contact as unknown as ContactData;
    const property = enrollment.property as unknown as PropertyData;

    if (!contact) {
      return NextResponse.json(
        { error: "Enrollment has no contact data" },
        { status: 400 }
      );
    }

    // Personalize all 3 emails
    const emails = [
      {
        num: 1,
        subject: personalizeEmail(campaign.email_1_subject, contact, property || {} as PropertyData),
        body: personalizeEmail(campaign.email_1_body, contact, property || {} as PropertyData),
      },
      {
        num: 2,
        subject: personalizeEmail(campaign.email_2_subject || "", contact, property || {} as PropertyData),
        body: personalizeEmail(campaign.email_2_body || "", contact, property || {} as PropertyData),
      },
      {
        num: 3,
        subject: personalizeEmail(campaign.email_3_subject || "", contact, property || {} as PropertyData),
        body: personalizeEmail(campaign.email_3_body || "", contact, property || {} as PropertyData),
      },
    ].filter(e => e.subject && e.body);

    if (emails.length === 0) {
      return NextResponse.json(
        { error: "No valid email templates to send" },
        { status: 400 }
      );
    }

    // Insert test emails into queue
    // Use 'manual_reply' job type to bypass send window
    // Stagger by 10 seconds each
    const now = new Date();
    const emailQueueEntries = emails.map((email, index) => ({
      job_type: "manual_reply",
      priority: 10, // High priority for test emails
      source: "api",
      to_email: testEmail,
      to_name: contact.name,
      subject: `[TEST ${email.num}/3] ${email.subject}`,
      body_text: email.body,
      contact_id: contact.id,
      property_id: property?.id || null,
      campaign_id: campaignId,
      scheduled_for: new Date(now.getTime() + index * 10000).toISOString(), // 10 seconds apart
      status: "pending",
      created_by: "test-send",
    }));

    const { error: queueError } = await supabase
      .from("email_queue")
      .insert(emailQueueEntries);

    if (queueError) {
      console.error("Error inserting test emails:", queueError);
      return NextResponse.json(
        { error: "Failed to queue test emails" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      emailsQueued: emails.length,
      testEmail,
      contact: {
        name: contact.name,
        email: contact.email,
      },
      property: property ? {
        address: property.address,
        city: property.city,
      } : null,
      preview: emails.map(e => ({
        num: e.num,
        subject: `[TEST ${e.num}/3] ${e.subject}`,
        bodyPreview: e.body.substring(0, 100) + "...",
      })),
    });
  } catch (error) {
    console.error("Send test error:", error);
    return NextResponse.json(
      { error: "Failed to send test emails" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/campaigns/[id]/send-test
 * Get list of enrollments available for testing
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: campaignId } = await params;
    const supabase = createAdminClient();

    const { data: enrollments, error } = await supabase
      .from("enrollments")
      .select(`
        id,
        contact:contacts(id, name, email),
        property:properties(id, address, city, state_code)
      `)
      .eq("campaign_id", campaignId)
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      enrollments: (enrollments || []).map(e => ({
        id: e.id,
        contact: e.contact,
        property: e.property,
      })),
    });
  } catch (error) {
    console.error("Get enrollments error:", error);
    return NextResponse.json(
      { error: "Failed to get enrollments" },
      { status: 500 }
    );
  }
}
