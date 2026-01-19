import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface ReprocessStats {
  emailsReset: number;
  jobQueued: boolean;
}

/**
 * POST - Reprocess all inbound emails
 *
 * Resets classification fields on all inbound emails and queues
 * the process-replies job to reclassify everything with fixed logic.
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();

  try {
    // Optional: Get confirmation from body
    const body = await request.json().catch(() => ({}));
    if (body.confirm !== true) {
      return NextResponse.json(
        {
          error: "Confirmation required",
          message: "Send { confirm: true } to proceed with reprocessing all emails",
        },
        { status: 400 }
      );
    }

    // Step 1: Count emails that will be affected
    const { count: totalCount } = await supabase
      .from("synced_emails")
      .select("*", { count: "exact", head: true })
      .eq("direction", "inbound");

    // Step 2: Reset classification fields on all inbound emails
    const { error: resetError, count: resetCount } = await supabase
      .from("synced_emails")
      .update({
        classification: null,
        classification_confidence: null,
        classification_reasoning: null,
        classified_at: null,
        classified_by: null,
        needs_human_review: false,
        auto_handled: false,
        action_taken: null,
        status: "new",
      })
      .eq("direction", "inbound")
      .select();

    if (resetError) {
      console.error("[reprocess-all] Failed to reset emails:", resetError);
      return NextResponse.json(
        { error: `Failed to reset emails: ${resetError.message}` },
        { status: 500 }
      );
    }

    // Step 3: Queue the process-replies job to run immediately
    const { error: queueError } = await supabase.rpc("queue_pgboss_job", {
      p_name: "process-replies",
      p_data: {
        reason: "reprocess-all triggered via API",
        triggeredAt: new Date().toISOString(),
      },
      p_options: {
        priority: 10, // High priority
        retryLimit: 3,
      },
    });

    if (queueError) {
      console.error("[reprocess-all] Failed to queue job:", queueError);
      // Don't fail the whole request - emails are already reset
      return NextResponse.json({
        success: true,
        warning: `Emails reset but failed to queue job: ${queueError.message}`,
        stats: {
          emailsReset: resetCount || totalCount || 0,
          jobQueued: false,
        } as ReprocessStats,
      });
    }

    console.log(
      `[reprocess-all] Reset ${resetCount || totalCount} emails and queued process-replies job`
    );

    return NextResponse.json({
      success: true,
      message: `Reset ${resetCount || totalCount} inbound emails. Processing will start shortly.`,
      stats: {
        emailsReset: resetCount || totalCount || 0,
        jobQueued: true,
      } as ReprocessStats,
    });
  } catch (err) {
    console.error("[reprocess-all] Unexpected error:", err);
    return NextResponse.json(
      { error: `Unexpected error: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 }
    );
  }
}

/**
 * GET - Check reprocess status / preview count
 */
export async function GET() {
  const supabase = createAdminClient();

  // Count emails by classification status
  const { data: classificationCounts, error: countError } = await supabase
    .from("synced_emails")
    .select("classification")
    .eq("direction", "inbound");

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  // Aggregate counts
  const counts: Record<string, number> = { total: 0, unclassified: 0 };
  for (const row of classificationCounts || []) {
    counts.total++;
    if (!row.classification) {
      counts.unclassified++;
    } else {
      counts[row.classification] = (counts[row.classification] || 0) + 1;
    }
  }

  return NextResponse.json({
    counts,
    message: `${counts.total} total inbound emails, ${counts.unclassified} unclassified`,
  });
}
