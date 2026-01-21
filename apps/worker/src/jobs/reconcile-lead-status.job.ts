/**
 * Reconcile Lead Status Job
 *
 * Updates lead statuses based on email activity in synced_emails.
 * Can be run on-demand or scheduled to keep statuses accurate.
 *
 * Priority order for status derivation:
 * 1. has_hot → engaged
 * 2. has_question → replied
 * 3. has_pass → nurture
 * 4. has_bounce → contacted (delivery failed, but we tried)
 * 5. inbound_count > 0 → replied (got response, unclassified)
 * 6. outbound_count > 0 → contacted (sent email, no response)
 *
 * Does NOT downgrade statuses (e.g., won't change qualified → engaged)
 * unless force flag is set.
 *
 * Usage:
 *   - CLI: npx ts-node src/jobs/reconcile-lead-status.job.ts [--dry-run] [--force]
 *   - API: POST /api/jobs/reconcile-lead-status
 *   - Job: boss.send('reconcile-lead-status', { dryRun: false, force: false })
 */

import PgBoss from "pg-boss";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:55321",
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
);

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

interface ReconcileOptions {
  dryRun?: boolean;
  force?: boolean; // Allow downgrades
  leadIds?: string[]; // Specific leads to reconcile
}

interface ReconcileResult {
  processed: number;
  updated: number;
  skipped: number;
  errors: number;
  changes: Array<{
    lead_id: string;
    lead_name: string;
    from_status: string;
    to_status: string;
  }>;
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

  // Only upgrade status (or force)
  if (force) return true;

  // Special case: new → anything is always allowed
  if (currentStatus === "new") return true;

  // Special case: allow lateral moves (contacted → nurture, replied → nurture)
  if (suggestedStatus === "nurture" && currentPriority <= 2) return true;

  return suggestedPriority > currentPriority;
}

export async function reconcileLeadStatuses(
  options: ReconcileOptions = {}
): Promise<ReconcileResult> {
  const { dryRun = false, force = false, leadIds } = options;

  const result: ReconcileResult = {
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    changes: [],
  };

  // Build the query to get lead email summaries
  let query = `
    WITH lead_email_summary AS (
      SELECT
        l.id as lead_id,
        l.name as lead_name,
        l.status as current_status,
        bool_or(se.classification = 'hot') as has_hot,
        bool_or(se.classification = 'pass') as has_pass,
        bool_or(se.classification = 'bounce') as has_bounce,
        bool_or(se.classification = 'question') as has_question,
        COUNT(*) FILTER (WHERE se.direction = 'outbound') as outbound_count,
        COUNT(*) FILTER (WHERE se.direction = 'inbound' AND se.from_email NOT LIKE '%lee-associates%') as inbound_count
      FROM leads l
      JOIN contacts c ON c.lead_id = l.id
      JOIN synced_emails se ON se.matched_contact_id = c.id
      ${leadIds?.length ? `WHERE l.id = ANY($1)` : ""}
      GROUP BY l.id, l.name, l.status
    )
    SELECT * FROM lead_email_summary
  `;

  const { data: summaries, error: queryError } = await supabase.rpc(
    "exec_sql",
    {
      sql: query,
      params: leadIds?.length ? [leadIds] : [],
    }
  );

  // Fallback: direct query if RPC not available
  let leadsToProcess: LeadEmailSummary[] = [];

  if (queryError) {
    // Use direct approach - fetch leads with email activity
    const { data: leads, error: leadsError } = await supabase
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

    if (leadsError) {
      console.error("Failed to fetch leads:", leadsError);
      throw leadsError;
    }

    // Process into summaries
    for (const lead of leads || []) {
      const emails = lead.contacts?.flatMap((c: any) => c.synced_emails || []) || [];
      if (emails.length === 0) continue;

      const summary: LeadEmailSummary = {
        lead_id: lead.id,
        lead_name: lead.name,
        current_status: lead.status,
        has_hot: emails.some((e: any) => e.classification === "hot"),
        has_pass: emails.some((e: any) => e.classification === "pass"),
        has_bounce: emails.some((e: any) => e.classification === "bounce"),
        has_question: emails.some((e: any) => e.classification === "question"),
        outbound_count: emails.filter((e: any) => e.direction === "outbound").length,
        inbound_count: emails.filter(
          (e: any) =>
            e.direction === "inbound" &&
            !e.from_email?.includes("lee-associates")
        ).length,
      };

      if (leadIds?.length && !leadIds.includes(lead.id)) continue;
      leadsToProcess.push(summary);
    }
  } else {
    leadsToProcess = summaries || [];
  }

  console.log(`Processing ${leadsToProcess.length} leads with email activity`);

  for (const summary of leadsToProcess) {
    result.processed++;

    const suggestedStatus = deriveSuggestedStatus(summary);

    if (!shouldUpdate(summary.current_status, suggestedStatus, force)) {
      result.skipped++;
      continue;
    }

    const change = {
      lead_id: summary.lead_id,
      lead_name: summary.lead_name,
      from_status: summary.current_status,
      to_status: suggestedStatus,
    };

    if (dryRun) {
      console.log(
        `[DRY RUN] Would update ${summary.lead_name}: ${summary.current_status} → ${suggestedStatus}`
      );
      result.changes.push(change);
      result.updated++;
      continue;
    }

    // Update the lead status
    const { error: updateError } = await supabase
      .from("leads")
      .update({
        status: suggestedStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", summary.lead_id);

    if (updateError) {
      console.error(`Failed to update lead ${summary.lead_id}:`, updateError);
      result.errors++;
      continue;
    }

    // Create activity record for the status change
    const { error: activityError } = await supabase.from("activities").insert({
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
        reconciled_by: "reconcile-lead-status-job",
      },
    });

    if (activityError) {
      console.warn(
        `Failed to create activity for lead ${summary.lead_id}:`,
        activityError
      );
      // Don't count as error - update succeeded
    }

    console.log(
      `Updated ${summary.lead_name}: ${summary.current_status} → ${suggestedStatus}`
    );
    result.changes.push(change);
    result.updated++;
  }

  return result;
}

/**
 * pg-boss job handler
 */
export async function handleReconcileLeadStatus(
  job: PgBoss.Job<ReconcileOptions>
): Promise<ReconcileResult> {
  const options = job.data || {};
  console.log(
    `[reconcile-lead-status] Starting (dryRun=${options.dryRun}, force=${options.force})`
  );

  const result = await reconcileLeadStatuses(options);

  console.log(
    `[reconcile-lead-status] Complete: ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors`
  );

  return result;
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");

  console.log(`\n=== Lead Status Reconciliation ===`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Force downgrades: ${force}`);
  console.log("");

  reconcileLeadStatuses({ dryRun, force })
    .then((result) => {
      console.log(`\n=== Results ===`);
      console.log(`Processed: ${result.processed}`);
      console.log(`Updated: ${result.updated}`);
      console.log(`Skipped: ${result.skipped}`);
      console.log(`Errors: ${result.errors}`);

      if (result.changes.length > 0) {
        console.log(`\nChanges:`);
        for (const change of result.changes) {
          console.log(
            `  ${change.lead_name}: ${change.from_status} → ${change.to_status}`
          );
        }
      }

      process.exit(result.errors > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("Fatal error:", err);
      process.exit(1);
    });
}
