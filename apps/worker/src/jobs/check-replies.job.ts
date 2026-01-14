import PgBoss from 'pg-boss';
import { supabase } from '../db.js';
import { config } from '../config.js';

export interface CheckRepliesResult {
  success: boolean;
  unclassifiedCount: number;
  queuedForClassification: number;
}

export async function handleCheckReplies(
  job: PgBoss.Job
): Promise<CheckRepliesResult> {
  console.log('[check-replies] Checking for unclassified emails...');

  // Find unclassified inbound emails
  const { data: unclassified, error } = await supabase
    .from('synced_emails')
    .select('id, from_email, subject, body_text')
    .eq('direction', 'inbound')
    .is('classification', null)
    .order('received_at', { ascending: true })
    .limit(50);

  if (error) {
    console.error('[check-replies] Query failed:', error.message);
    throw new Error(error.message);
  }

  const unclassifiedCount = unclassified?.length || 0;
  console.log(`[check-replies] Found ${unclassifiedCount} unclassified emails`);

  if (!unclassified || unclassified.length === 0) {
    return {
      success: true,
      unclassifiedCount: 0,
      queuedForClassification: 0,
    };
  }

  // Get pg-boss instance from the job
  // We need to queue classify jobs
  const boss = (job as unknown as { boss?: PgBoss }).boss;

  let queued = 0;

  if (boss) {
    // Queue classification jobs
    for (const email of unclassified) {
      try {
        await boss.send('classify-email', {
          emailId: email.id,
          fromEmail: email.from_email,
          subject: email.subject,
          bodyPreview: email.body_text?.substring(0, 500),
        });
        queued++;
      } catch (err) {
        console.error(`[check-replies] Failed to queue ${email.id}:`, err);
      }
    }
  } else {
    // Fallback: just mark them for classification later
    console.log('[check-replies] No boss instance, emails will be classified on next run');

    // Mark as needs_human_review so they show up in the UI
    const ids = unclassified.map((e) => e.id);
    await supabase
      .from('synced_emails')
      .update({ needs_human_review: true })
      .in('id', ids);
  }

  console.log(`[check-replies] Queued ${queued} emails for classification`);

  return {
    success: true,
    unclassifiedCount,
    queuedForClassification: queued,
  };
}
