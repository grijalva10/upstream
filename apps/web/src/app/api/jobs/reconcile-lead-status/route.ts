import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Reconcile Lead Status API
 *
 * Updates lead statuses based on email activity.
 *
 * GET: Preview changes (dry run)
 * POST: Apply changes + return hot leads review report
 *
 * Query params:
 *   - force: Allow status downgrades (default: false)
 *   - leadId: Specific lead to reconcile (optional)
 */

// Status priority - higher index = more advanced in pipeline
const STATUS_PRIORITY: Record<string, number> = {
  new: 0,
  contacted: 1,
  replied: 2,
  engaged: 3,
  waiting: 4,
  qualified: 5,
  handed_off: 6,
  nurture: 2, // Same as replied - lateral move
  closed: 7, // Terminal
};

interface LeadEmailSummary {
  lead_id: string;
  lead_name: string;
  current_status: string;
  has_hot: boolean;
  has_pass: boolean;
  has_bounce: boolean;
  has_question: boolean;
  outbound_count: number;
  inbound_count: number;
}

interface HotLeadReview {
  lead_id: string;
  lead_name: string;
  contact_name: string | null;
  contact_email: string | null;
  last_hot_email_date: string;
  last_hot_email_snippet: string;
  last_activity_date: string;
  days_since_last_activity: number;
  we_replied_after: boolean;
  assessment: "promising" | "stale" | "needs_review";
  reason: string;
}

function deriveSuggestedStatus(summary: LeadEmailSummary): string {
  if (summary.has_hot) return "engaged";
  if (summary.has_question) return "replied";
  if (summary.has_pass) return "nurture";
  if (summary.has_bounce) return "contacted";
  if (summary.inbound_count > 0) return "replied";
  if (summary.outbound_count > 0) return "contacted";
  return summary.current_status;
}

function shouldUpdate(
  currentStatus: string,
  suggestedStatus: string,
  force: boolean
): boolean {
  if (currentStatus === suggestedStatus) return false;

  // Terminal statuses - don't change unless forced
  if (currentStatus === "closed" || currentStatus === "handed_off") {
    return force;
  }

  const currentPriority = STATUS_PRIORITY[currentStatus] ?? 0;
  const suggestedPriority = STATUS_PRIORITY[suggestedStatus] ?? 0;

  if (force) return true;

  // Special case: new → anything is always allowed
  if (currentStatus === "new") return true;

  // Special case: allow lateral moves (contacted → nurture, replied → nurture)
  if (suggestedStatus === "nurture" && currentPriority <= 2) return true;

  return suggestedPriority > currentPriority;
}

async function getLeadEmailSummaries(
  supabase: ReturnType<typeof createAdminClient>,
  leadId?: string
): Promise<LeadEmailSummary[]> {
  // Fetch leads with their contacts and email activity
  let query = supabase
    .from("leads")
    .select(
      `
      id,
      name,
      status,
      contacts!inner (
        id,
        synced_emails:synced_emails!matched_contact_id (
          direction,
          classification,
          from_email
        )
      )
    `
    )
    .order("updated_at", { ascending: false });

  if (leadId) {
    query = query.eq("id", leadId);
  }

  const { data: leads, error } = await query;

  if (error) {
    throw error;
  }

  const summaries: LeadEmailSummary[] = [];

  for (const lead of leads || []) {
    const emails =
      lead.contacts?.flatMap((c: any) => c.synced_emails || []) || [];
    if (emails.length === 0) continue;

    summaries.push({
      lead_id: lead.id,
      lead_name: lead.name,
      current_status: lead.status,
      has_hot: emails.some((e: any) => e.classification === "hot"),
      has_pass: emails.some((e: any) => e.classification === "pass"),
      has_bounce: emails.some((e: any) => e.classification === "bounce"),
      has_question: emails.some((e: any) => e.classification === "question"),
      outbound_count: emails.filter((e: any) => e.direction === "outbound")
        .length,
      inbound_count: emails.filter(
        (e: any) =>
          e.direction === "inbound" && !e.from_email?.includes("lee-associates")
      ).length,
    });
  }

  return summaries;
}

async function generateHotLeadsReview(
  supabase: ReturnType<typeof createAdminClient>,
  leadIds: string[]
): Promise<HotLeadReview[]> {
  const reviews: HotLeadReview[] = [];

  for (const leadId of leadIds) {
    // Get lead with contacts and emails
    const { data: lead } = await supabase
      .from("leads")
      .select(
        `
        id,
        name,
        contacts (
          id,
          name,
          email,
          synced_emails:synced_emails!matched_contact_id (
            id,
            direction,
            classification,
            from_email,
            body_text,
            sent_at,
            received_at
          )
        )
      `
      )
      .eq("id", leadId)
      .single();

    if (!lead) continue;

    // Flatten all emails from all contacts
    const allEmails: any[] = [];
    let primaryContact: any = null;

    for (const contact of lead.contacts || []) {
      if (!primaryContact && contact.email) {
        primaryContact = contact;
      }
      for (const email of contact.synced_emails || []) {
        allEmails.push({ ...email, contact });
      }
    }

    // Find the most recent "hot" inbound email
    const hotEmails = allEmails
      .filter((e) => e.classification === "hot" && e.direction === "inbound")
      .sort(
        (a, b) =>
          new Date(b.received_at || b.sent_at).getTime() -
          new Date(a.received_at || a.sent_at).getTime()
      );

    if (hotEmails.length === 0) continue;

    const lastHotEmail = hotEmails[0];
    const lastHotDate = new Date(
      lastHotEmail.received_at || lastHotEmail.sent_at
    );

    // Find the most recent email (any direction)
    const sortedEmails = allEmails.sort(
      (a, b) =>
        new Date(b.sent_at || b.received_at).getTime() -
        new Date(a.sent_at || a.received_at).getTime()
    );
    const lastEmail = sortedEmails[0];
    const lastActivityDate = new Date(lastEmail?.sent_at || lastEmail?.received_at);

    // Check if we replied after the hot email
    const ourRepliesAfterHot = allEmails.filter(
      (e) =>
        e.direction === "outbound" &&
        new Date(e.sent_at) > lastHotDate
    );
    const weRepliedAfter = ourRepliesAfterHot.length > 0;

    // Calculate days since last activity
    const daysSinceLastActivity = Math.floor(
      (Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Extract snippet from hot email
    let snippet = lastHotEmail.body_text || "";
    // Remove common noise
    snippet = snippet
      .replace(/External Sender:[\s\S]*?validated\./gi, "")
      .replace(/^[\s\n]+/, "")
      .substring(0, 200);
    if (snippet.length === 200) snippet += "...";

    // Assess the lead
    let assessment: "promising" | "stale" | "needs_review";
    let reason: string;

    if (daysSinceLastActivity <= 14) {
      if (weRepliedAfter) {
        assessment = "promising";
        reason = "Recent activity, we followed up";
      } else {
        assessment = "promising";
        reason = "Recent hot reply, needs follow-up";
      }
    } else if (daysSinceLastActivity <= 30) {
      if (weRepliedAfter) {
        assessment = "needs_review";
        reason = `${daysSinceLastActivity} days since last activity, we replied but no response`;
      } else {
        assessment = "promising";
        reason = `${daysSinceLastActivity} days old but we never followed up - may still be viable`;
      }
    } else {
      if (weRepliedAfter) {
        assessment = "stale";
        reason = `${daysSinceLastActivity} days since last activity, already followed up`;
      } else {
        assessment = "needs_review";
        reason = `${daysSinceLastActivity} days old, we never followed up - worth a shot?`;
      }
    }

    reviews.push({
      lead_id: lead.id,
      lead_name: lead.name,
      contact_name: primaryContact?.name || lastHotEmail.contact?.name || null,
      contact_email:
        primaryContact?.email || lastHotEmail.from_email || null,
      last_hot_email_date: lastHotDate.toISOString(),
      last_hot_email_snippet: snippet,
      last_activity_date: lastActivityDate.toISOString(),
      days_since_last_activity: daysSinceLastActivity,
      we_replied_after: weRepliedAfter,
      assessment,
      reason,
    });
  }

  // Sort by assessment priority (promising first) then by days
  const assessmentOrder = { promising: 0, needs_review: 1, stale: 2 };
  reviews.sort((a, b) => {
    const orderDiff = assessmentOrder[a.assessment] - assessmentOrder[b.assessment];
    if (orderDiff !== 0) return orderDiff;
    return a.days_since_last_activity - b.days_since_last_activity;
  });

  return reviews;
}

// GET: Preview changes (dry run)
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";
  const leadId = searchParams.get("leadId") || undefined;

  try {
    const summaries = await getLeadEmailSummaries(supabase, leadId);

    const changes = [];
    for (const summary of summaries) {
      const suggestedStatus = deriveSuggestedStatus(summary);
      if (shouldUpdate(summary.current_status, suggestedStatus, force)) {
        changes.push({
          lead_id: summary.lead_id,
          lead_name: summary.lead_name,
          current_status: summary.current_status,
          suggested_status: suggestedStatus,
          has_hot: summary.has_hot,
          has_pass: summary.has_pass,
          has_bounce: summary.has_bounce,
          has_question: summary.has_question,
          outbound_count: summary.outbound_count,
          inbound_count: summary.inbound_count,
        });
      }
    }

    // Group by current → suggested for summary
    const summary: Record<string, number> = {};
    for (const change of changes) {
      const key = `${change.current_status} → ${change.suggested_status}`;
      summary[key] = (summary[key] || 0) + 1;
    }

    return NextResponse.json({
      mode: "dry_run",
      total_leads_with_activity: summaries.length,
      changes_needed: changes.length,
      summary,
      changes,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Apply changes
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

  let body: { leadIds?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    // No body is fine
  }

  const leadIds = body.leadIds;

  try {
    const summaries = await getLeadEmailSummaries(
      supabase,
      leadIds?.[0] // For single lead, use first
    );

    // Filter to specific leads if provided
    const toProcess = leadIds?.length
      ? summaries.filter((s) => leadIds.includes(s.lead_id))
      : summaries;

    const results = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      changes: [] as Array<{
        lead_id: string;
        lead_name: string;
        from_status: string;
        to_status: string;
      }>,
    };

    for (const summary of toProcess) {
      results.processed++;

      const suggestedStatus = deriveSuggestedStatus(summary);
      if (!shouldUpdate(summary.current_status, suggestedStatus, force)) {
        results.skipped++;
        continue;
      }

      // Update lead status
      const { error: updateError } = await supabase
        .from("leads")
        .update({
          status: suggestedStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", summary.lead_id);

      if (updateError) {
        console.error(`Failed to update lead ${summary.lead_id}:`, updateError);
        results.errors++;
        continue;
      }

      // Create activity record
      await supabase.from("activities").insert({
        lead_id: summary.lead_id,
        activity_type: "status_change",
        description: `Status reconciled: ${summary.current_status} → ${suggestedStatus} (based on email activity)`,
        metadata: {
          from_status: summary.current_status,
          to_status: suggestedStatus,
          has_hot: summary.has_hot,
          has_pass: summary.has_pass,
          has_bounce: summary.has_bounce,
          has_question: summary.has_question,
          outbound_count: summary.outbound_count,
          inbound_count: summary.inbound_count,
          reconciled_by: "reconcile-lead-status-api",
        },
      });

      results.changes.push({
        lead_id: summary.lead_id,
        lead_name: summary.lead_name,
        from_status: summary.current_status,
        to_status: suggestedStatus,
      });
      results.updated++;
    }

    // Generate hot leads review report
    const hotLeadIds = results.changes
      .filter((c) => c.to_status === "engaged")
      .map((c) => c.lead_id);

    let hotLeadsReview: HotLeadReview[] = [];
    if (hotLeadIds.length > 0) {
      hotLeadsReview = await generateHotLeadsReview(supabase, hotLeadIds);
    }

    return NextResponse.json({
      mode: "applied",
      ...results,
      hot_leads_review: hotLeadsReview,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
