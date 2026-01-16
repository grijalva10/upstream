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
  year_acquired: number | null;
}

interface EnrollmentRow {
  id: string;
  contact_id: string;
  property_id: string;
  contact: ContactData | null;
  property: PropertyData | null;
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

  // Property address (full)
  const fullAddress = [property.address, property.city, property.state_code]
    .filter(Boolean)
    .join(", ");
  result = result.replace(/\{\{property_address\}\}/gi, fullAddress || "the property");
  result = result.replace(/\{\{address\}\}/gi, property.address || "the property");

  // Property type (lowercase mid-sentence)
  const propertyType = property.property_type?.toLowerCase() || "commercial";
  result = result.replace(/\{\{property_type\}\}/gi, propertyType);

  // Building size (formatted with commas)
  const buildingSf = property.building_size_sqft;
  const sfDisplay = buildingSf ? `${buildingSf.toLocaleString()} SF` : "";
  result = result.replace(/\{\{building_sf\}\}/gi, sfDisplay);
  result = result.replace(/\{\{size\}\}/gi, sfDisplay);

  // Years held
  const currentYear = new Date().getFullYear();
  const yearAcquired = property.year_acquired;
  const yearsHeld = yearAcquired ? currentYear - yearAcquired : null;
  if (yearsHeld && yearsHeld > 0) {
    result = result.replace(/\{\{years_held\}\}/gi, String(yearsHeld));
  } else {
    // Remove the entire phrase if years_held is not available
    result = result.replace(/for \{\{years_held\}\} years?/gi, "");
    result = result.replace(/\{\{years_held\}\} years? of ownership/gi, "");
    result = result.replace(/\{\{years_held\}\}/gi, "");
  }

  // Year built
  result = result.replace(/\{\{year_built\}\}/gi, String(property.year_built || ""));

  // City
  result = result.replace(/\{\{city\}\}/gi, property.city || "");

  // State
  result = result.replace(/\{\{state\}\}/gi, property.state_code || "");

  // Clean up any double spaces
  result = result.replace(/  +/g, " ");

  return result;
}

/**
 * Calculate send time for an email with jitter
 */
function calculateSendTime(
  baseTime: Date,
  index: number,
  sendWindowStart: string,
  sendWindowEnd: string,
  timezone: string
): Date {
  // Parse send window times
  const [startHour, startMin] = sendWindowStart.split(":").map(Number);
  const [endHour, endMin] = sendWindowEnd.split(":").map(Number);

  // Start from base time
  const sendTime = new Date(baseTime);

  // Add stagger: ~30 seconds to 2 minutes between each email
  const staggerMs = index * (30000 + Math.random() * 90000);
  sendTime.setTime(sendTime.getTime() + staggerMs);

  // Ensure within send window (simple implementation - doesn't handle timezone perfectly)
  const hours = sendTime.getHours();
  if (hours < startHour || (hours === startHour && sendTime.getMinutes() < startMin)) {
    sendTime.setHours(startHour, startMin, 0, 0);
  } else if (hours >= endHour) {
    // Move to next day at window start
    sendTime.setDate(sendTime.getDate() + 1);
    sendTime.setHours(startHour, startMin, 0, 0);
  }

  // Skip weekends
  while (sendTime.getDay() === 0 || sendTime.getDay() === 6) {
    sendTime.setDate(sendTime.getDate() + 1);
  }

  return sendTime;
}

/**
 * POST /api/campaigns/[id]/activate
 * Activates a campaign by scheduling all email 1s to the email_queue
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: campaignId } = await params;
    const body = await request.json().catch(() => ({}));
    const { scheduledStartAt } = body;

    if (!scheduledStartAt) {
      return NextResponse.json(
        { error: "scheduledStartAt is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.status !== "draft") {
      return NextResponse.json(
        { error: "Can only activate draft campaigns" },
        { status: 400 }
      );
    }

    if (!campaign.email_1_subject || !campaign.email_1_body) {
      return NextResponse.json(
        { error: "Campaign must have email 1 content before activating" },
        { status: 400 }
      );
    }

    // Get all pending enrollments with contact and property data
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from("enrollments")
      .select(`
        id,
        contact_id,
        property_id,
        contact:contacts(id, name, email),
        property:properties(id, address, city, state_code, property_type, building_size_sqft, year_built, year_acquired)
      `)
      .eq("campaign_id", campaignId)
      .eq("status", "pending");

    if (enrollmentsError) {
      console.error("Error fetching enrollments:", enrollmentsError);
      return NextResponse.json(
        { error: "Failed to fetch enrollments" },
        { status: 500 }
      );
    }

    if (!enrollments || enrollments.length === 0) {
      return NextResponse.json(
        { error: "No pending enrollments to activate" },
        { status: 400 }
      );
    }

    const baseTime = new Date(scheduledStartAt);
    const sendWindowStart = campaign.send_window_start || "09:00";
    const sendWindowEnd = campaign.send_window_end || "17:00";
    const timezone = campaign.timezone || "America/Los_Angeles";

    // Build email queue entries
    const emailQueueEntries = [];
    const enrollmentIds = [];

    for (let i = 0; i < enrollments.length; i++) {
      const enrollment = enrollments[i] as unknown as EnrollmentRow;
      const contact = enrollment.contact;
      const property = enrollment.property;

      if (!contact?.email) {
        console.warn(`Skipping enrollment ${enrollment.id}: no contact email`);
        continue;
      }

      // Personalize email
      const subject = personalizeEmail(
        campaign.email_1_subject,
        contact,
        property || ({} as PropertyData)
      );
      const bodyText = personalizeEmail(
        campaign.email_1_body,
        contact,
        property || ({} as PropertyData)
      );

      // Calculate send time with stagger
      const sendTime = calculateSendTime(
        baseTime,
        i,
        sendWindowStart,
        sendWindowEnd,
        timezone
      );

      emailQueueEntries.push({
        job_type: "cold_outreach",
        priority: 5,
        source: "api",
        to_email: contact.email,
        to_name: contact.name,
        subject,
        body_text: bodyText,
        contact_id: enrollment.contact_id,
        property_id: enrollment.property_id,
        campaign_id: campaignId,
        enrollment_id: enrollment.id,
        scheduled_for: sendTime.toISOString(),
        status: "pending",
        created_by: "campaign-activate",
      });

      enrollmentIds.push(enrollment.id);
    }

    if (emailQueueEntries.length === 0) {
      return NextResponse.json(
        { error: "No valid enrollments with contact emails" },
        { status: 400 }
      );
    }

    // Insert into email_queue
    const { error: queueError } = await supabase
      .from("email_queue")
      .insert(emailQueueEntries);

    if (queueError) {
      console.error("Error inserting into email_queue:", queueError);
      return NextResponse.json(
        { error: "Failed to schedule emails" },
        { status: 500 }
      );
    }

    // Update enrollments to active, current_step = 1
    const { error: updateEnrollmentsError } = await supabase
      .from("enrollments")
      .update({ status: "active", current_step: 1 })
      .in("id", enrollmentIds);

    if (updateEnrollmentsError) {
      console.error("Error updating enrollments:", updateEnrollmentsError);
      // Don't fail - emails are scheduled
    }

    // Update campaign status and scheduled_start_at
    const { error: updateCampaignError } = await supabase
      .from("campaigns")
      .update({
        status: "active",
        scheduled_start_at: scheduledStartAt,
        started_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    if (updateCampaignError) {
      console.error("Error updating campaign:", updateCampaignError);
      // Don't fail - emails are scheduled
    }

    return NextResponse.json({
      success: true,
      emailsScheduled: emailQueueEntries.length,
      scheduledStartAt,
      firstSendAt: emailQueueEntries[0]?.scheduled_for,
      lastSendAt: emailQueueEntries[emailQueueEntries.length - 1]?.scheduled_for,
    });
  } catch (error) {
    console.error("Activate campaign error:", error);
    return NextResponse.json(
      { error: "Failed to activate campaign" },
      { status: 500 }
    );
  }
}
