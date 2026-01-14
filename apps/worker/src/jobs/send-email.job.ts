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
  sequenceId?: string;
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
  job: PgBoss.Job<SendEmailPayload>
): Promise<SendEmailResult> {
  const { queueId, toEmail, subject, bodyText, priority, jobType, sequenceId } = job.data;
  console.log(`[send-email] Processing ${queueId} -> ${toEmail}`);

  // Get sequence settings if this is a campaign email
  let sendWindowStart = '09:00';
  let sendWindowEnd = '17:00';
  let timezone = config.defaultTimezone;
  let weekdaysOnly = true;
  let spacingMin = 30;
  let spacingMax = 90;
  let humanize = true;
  let simulateBreaks = true;

  if (sequenceId && (jobType === 'cold_outreach' || jobType === 'follow_up')) {
    const { data: sequence } = await supabase
      .from('sequences')
      .select('*')
      .eq('id', sequenceId)
      .single();

    if (sequence) {
      sendWindowStart = sequence.send_window_start || '09:00';
      sendWindowEnd = sequence.send_window_end || '17:00';
      timezone = sequence.timezone || config.defaultTimezone;
      weekdaysOnly = sequence.weekdays_only ?? true;
      spacingMin = sequence.spacing_min_sec ?? 30;
      spacingMax = sequence.spacing_max_sec ?? 90;
      humanize = sequence.humanize_timing ?? true;
      simulateBreaks = sequence.simulate_breaks ?? true;
    }
  }

  // For campaign emails, check send window
  const isCampaignEmail = jobType === 'cold_outreach' || jobType === 'follow_up';

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
    if (config.dryRun) {
      console.log(`[send-email] DRY RUN: Would send to ${toEmail}`);
      console.log(`  Subject: ${subject}`);
    } else {
      await sendViaOutlook(toEmail, subject, bodyText);
    }

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
