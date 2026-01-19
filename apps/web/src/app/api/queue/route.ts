import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const body = await request.json();

  const {
    jobType = "manual_reply",
    source = "api",
    priority = 5,
    toEmail,
    toName,
    subject,
    bodyText,
    bodyHtml,
    campaignId,
    enrollmentId,
    contactId,
    leadId,
    propertyId,
    inReplyToEmailId,
    scheduledFor,
  } = body;

  // Validate required fields
  if (!toEmail || !subject || !bodyText) {
    return NextResponse.json(
      { error: "Missing required fields: toEmail, subject, bodyText" },
      { status: 400 }
    );
  }

  // Validate job type
  const validJobTypes = [
    "cold_outreach",
    "follow_up",
    "manual_reply",
    "qualification",
    "scheduling",
  ];
  if (!validJobTypes.includes(jobType)) {
    return NextResponse.json(
      { error: `Invalid jobType. Must be one of: ${validJobTypes.join(", ")}` },
      { status: 400 }
    );
  }

  // Insert into queue
  const { data, error } = await supabase
    .from("email_queue")
    .insert({
      job_type: jobType,
      source,
      priority: jobType === "manual_reply" ? 10 : priority,
      to_email: toEmail,
      to_name: toName,
      subject,
      body_text: bodyText,
      body_html: bodyHtml,
      campaign_id: campaignId,
      enrollment_id: enrollmentId,
      contact_id: contactId,
      lead_id: leadId,
      property_id: propertyId,
      in_reply_to_email_id: inReplyToEmailId,
      scheduled_for: scheduledFor || new Date().toISOString(),
      created_by: source,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    queueId: data.id,
    message: "Email queued successfully",
  });
}

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();

  // Get queue stats
  const { data: stats, error } = await supabase.rpc("get_queue_stats");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get worker status
  const { data: worker } = await supabase
    .from("worker_status")
    .select("*")
    .eq("id", "main")
    .single();

  return NextResponse.json({
    stats: stats?.[0] || null,
    worker: worker || null,
  });
}
