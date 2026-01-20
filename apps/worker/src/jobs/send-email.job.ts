import PgBoss from 'pg-boss';
import { supabase, checkRateLimit, incrementSendCount } from '../db.js';
import { config } from '../config.js';
import { sendViaOutlook } from '../lib/outlook-bridge.js';
import { isWithinSendWindow, getNextWindowStart } from '../lib/send-window.js';
import { getRandomDelay } from '../lib/humanize.js';

export interface SendEmailPayload {
  queueId: string;
  toEmail: string;
  toName?: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  campaignId?: string;
  priority: number;
  jobType: string;
}

export interface SendEmailResult {
  success: boolean;
  queueId: string;
  sentAt?: string;
  error?: string;
  rescheduled?: boolean;
  rescheduledFor?: string;
}

export async function handleSendEmail(
  job: PgBoss.Job<SendEmailPayload> | PgBoss.Job<SendEmailPayload>[]
): Promise<SendEmailResult> {
  // pg-boss 10.x passes jobs as array even for single items
  const actualJob = Array.isArray(job) ? job[0] : job;

  if (!actualJob?.data) {
    console.error('[send-email] job.data is undefined! Full job:', job);
    throw new Error('Job data is undefined');
  }

  const { queueId, toEmail, subject, bodyText, priority, jobType, campaignId } = actualJob.data;
  console.log(`[send-email] Processing ${queueId} -> ${toEmail} (type: ${jobType})`);

  // Determine email category based on job type
  const emailCategory = getEmailCategory(jobType, campaignId);
  const sendingEnabled = config.emailSending[emailCategory];

  if (!sendingEnabled) {
    console.log(`[send-email] ${emailCategory} emails disabled - marking as skipped`);

    // Mark as skipped so it doesn't keep retrying
    await supabase
      .from('email_queue')
      .update({
        status: 'skipped',
        last_error: `${emailCategory} emails disabled`,
      })
      .eq('id', queueId);

    return {
      success: true,
      queueId,
      error: `${emailCategory} emails disabled`,
    };
  }

  // Get campaign settings if this is a campaign email
  let sendWindowStart = '09:00';
  let sendWindowEnd = '17:00';
  let timezone = config.defaultTimezone;
  let weekdaysOnly = true;
  let spacingMin = 30;
  let spacingMax = 90;
  let humanize = true;
  let simulateBreaks = true;

  if (campaignId && (jobType === 'cold_outreach' || jobType === 'follow_up')) {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaign) {
      sendWindowStart = campaign.send_window_start || '09:00';
      sendWindowEnd = campaign.send_window_end || '17:00';
      timezone = campaign.timezone || config.defaultTimezone;
      weekdaysOnly = campaign.weekdays_only ?? true;
      spacingMin = campaign.spacing_min_sec ?? 30;
      spacingMax = campaign.spacing_max_sec ?? 90;
      humanize = campaign.humanize_timing ?? true;
      simulateBreaks = campaign.simulate_breaks ?? true;
    }
  }

  // For campaign emails, check send window
  const isCampaignEmail = emailCategory === 'campaign';
  if (isCampaignEmail) {
    const inWindow = isWithinSendWindow(
      sendWindowStart,
      sendWindowEnd,
      timezone,
      weekdaysOnly,
      humanize ? { min: -15, max: 15 } : undefined
    );

    if (!inWindow) {
      const nextWindow = getNextWindowStart(sendWindowStart, timezone, weekdaysOnly);
      console.log(`[send-email] Outside window, rescheduling for ${nextWindow.toISOString()}`);

      await supabase
        .from('email_queue')
        .update({
          scheduled_for: nextWindow.toISOString(),
          status: 'scheduled',
        })
        .eq('id', queueId);

      return {
        success: true,
        queueId,
        rescheduled: true,
        rescheduledFor: nextWindow.toISOString(),
      };
    }
  }

  // Check rate limits
  const rateCheck = await checkRateLimit();
  if (!rateCheck.canSend) {
    console.log(`[send-email] Rate limited: ${rateCheck.reason}`);

    // Reschedule for 5 minutes later
    const retryAt = new Date(Date.now() + 5 * 60 * 1000);
    await supabase
      .from('email_queue')
      .update({
        next_retry_at: retryAt.toISOString(),
        last_error: rateCheck.reason,
      })
      .eq('id', queueId);

    throw new Error(rateCheck.reason);
  }

  // For campaign emails, add delay between sends
  if (isCampaignEmail) {
    const delay = getRandomDelay(spacingMin, spacingMax, simulateBreaks);
    if (delay > 0) {
      console.log(`[send-email] Waiting ${Math.round(delay / 1000)}s before sending`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Mark as processing
  await supabase
    .from('email_queue')
    .update({ status: 'processing', processed_at: new Date().toISOString() })
    .eq('id', queueId);

  // Send the email
  try {
    await sendViaOutlook(toEmail, subject, bodyText);

    const sentAt = new Date().toISOString();

    // Update queue status
    await supabase
      .from('email_queue')
      .update({
        status: 'sent',
        sent_at: sentAt,
      })
      .eq('id', queueId);

    // Increment rate counter
    await incrementSendCount();

    // Update lead status to 'contacted' if this is first outreach
    // and auto-complete any incoming_email tasks for this contact
    try {
      const { data: queueRecord } = await supabase
        .from('email_queue')
        .select('contact_id')
        .eq('id', queueId)
        .single();

      if (queueRecord?.contact_id) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('lead_id')
          .eq('id', queueRecord.contact_id)
          .single();

        if (contact?.lead_id) {
          // Only update if currently 'new'
          const { error: updateError } = await supabase
            .from('leads')
            .update({ status: 'contacted' })
            .eq('id', contact.lead_id)
            .eq('status', 'new');

          if (!updateError) {
            console.log(`[send-email] Updated lead ${contact.lead_id} status to 'contacted'`);
          }

          // Auto-complete incoming_email tasks for this contact
          const { data: completedTasks, error: taskError } = await supabase
            .from('tasks')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('type', 'incoming_email')
            .eq('contact_id', queueRecord.contact_id)
            .in('status', ['pending', 'snoozed'])
            .select('id');

          if (!taskError && completedTasks && completedTasks.length > 0) {
            console.log(`[send-email] Auto-completed ${completedTasks.length} incoming_email task(s)`);
          }
        }
      }
    } catch (err) {
      // Don't fail the job if status update fails
      console.warn('[send-email] Failed to update lead status or tasks:', err);
    }

    console.log(`[send-email] Sent to ${toEmail}`);

    return {
      success: true,
      queueId,
      sentAt,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[send-email] Failed:`, errorMessage);

    // Get current attempt count
    const { data: queueItem } = await supabase
      .from('email_queue')
      .select('attempts, max_attempts')
      .eq('id', queueId)
      .single();

    const attempts = (queueItem?.attempts || 0) + 1;
    const maxAttempts = queueItem?.max_attempts || 3;

    // Update queue with error
    await supabase
      .from('email_queue')
      .update({
        attempts,
        last_error: errorMessage,
        status: attempts >= maxAttempts ? 'failed' : 'pending',
        next_retry_at: attempts < maxAttempts
          ? new Date(Date.now() + attempts * 60 * 1000).toISOString()
          : null,
      })
      .eq('id', queueId);

    throw error;
  }
}

// Categorize email by job type for sending controls
type EmailCategory = 'campaign' | 'manual' | 'ai';

function getEmailCategory(jobType: string, campaignId?: string): EmailCategory {
  // Campaign emails: cold outreach or campaign-based follow-ups
  if (jobType === 'cold_outreach' || (jobType === 'follow_up' && campaignId)) {
    return 'campaign';
  }
  // AI emails: automated replies and non-campaign follow-ups
  if (jobType === 'manual_reply' || jobType === 'ai_response' || (jobType === 'follow_up' && !campaignId)) {
    return 'ai';
  }
  // Default to manual for explicit manual type or unknown types
  return 'manual';
}
