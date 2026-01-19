import PgBoss from 'pg-boss';
import { supabase, checkRateLimit } from '../db.js';
import { config } from '../config.js';

export interface ProcessQueueResult {
  success: boolean;
  processed: number;
  skipped: number;
  rateLimited: boolean;
}

/**
 * Create a process-queue handler with access to the boss instance
 */
export function createProcessQueueHandler(boss: PgBoss) {
  return async function handleProcessQueue(
    job: PgBoss.Job | PgBoss.Job[]
  ): Promise<ProcessQueueResult> {
    // pg-boss 10.x passes jobs as array even for single items
    const actualJob = Array.isArray(job) ? job[0] : job;
    void actualJob; // We don't need job data for this handler
    // Check if we're rate limited before querying
    const rateCheck = await checkRateLimit();
    if (!rateCheck.canSend) {
      if (config.debug) {
        console.log(`[process-queue] Rate limited: ${rateCheck.reason}`);
      }
      return {
        success: true,
        processed: 0,
        skipped: 0,
        rateLimited: true,
      };
    }

    // Get pending emails that are ready to send
    // Priority 10 (manual replies) first, then by scheduled time
    const { data: pendingEmails, error } = await supabase
      .from('email_queue')
      .select('*')
      .in('status', ['pending', 'scheduled'])
      .lte('scheduled_for', new Date().toISOString())
      .order('priority', { ascending: false })
      .order('scheduled_for', { ascending: true })
      .limit(10);

    if (error) {
      console.error('[process-queue] Query failed:', error.message);
      throw new Error(error.message);
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      if (config.debug) {
        console.log('[process-queue] No pending emails');
      }
      return {
        success: true,
        processed: 0,
        skipped: 0,
        rateLimited: false,
      };
    }

    console.log(`[process-queue] Found ${pendingEmails.length} emails to process`);

    let processed = 0;
    let skipped = 0;

    for (const email of pendingEmails) {
      // Skip if over rate limit
      const currentRate = await checkRateLimit();
      if (!currentRate.canSend) {
        console.log(`[process-queue] Rate limit reached, stopping`);
        skipped = pendingEmails.length - processed;
        break;
      }

      try {
        // Mark as processing first to prevent double-processing
        await supabase
          .from('email_queue')
          .update({ status: 'processing' })
          .eq('id', email.id);

        await boss.send('send-email', {
          queueId: email.id,
          toEmail: email.to_email,
          toName: email.to_name,
          subject: email.subject,
          bodyText: email.body_text,
          bodyHtml: email.body_html,
          campaignId: email.campaign_id,
          priority: email.priority,
          jobType: email.job_type,
        });
        processed++;
      } catch (err) {
        console.error(`[process-queue] Failed to queue ${email.id}:`, err);
        // Revert status on failure
        await supabase
          .from('email_queue')
          .update({ status: 'pending' })
          .eq('id', email.id);
        skipped++;
      }
    }

    console.log(`[process-queue] Queued ${processed} emails, skipped ${skipped}`);

    return {
      success: true,
      processed,
      skipped,
      rateLimited: false,
    };
  };
}

// Keep old export for backwards compatibility (unused)
export async function handleProcessQueue(
  job: PgBoss.Job
): Promise<ProcessQueueResult> {
  console.warn('[process-queue] Using legacy handler without boss instance');
  return {
    success: false,
    processed: 0,
    skipped: 0,
    rateLimited: false,
  };
}
