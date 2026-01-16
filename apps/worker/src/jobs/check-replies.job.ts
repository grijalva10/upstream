import PgBoss from 'pg-boss';
import { supabase } from '../db.js';

export interface CheckRepliesResult {
  success: boolean;
  unclassifiedCount: number;
  queuedForClassification: number;
}

/**
 * Create a check-replies handler with access to the boss instance
 */
export function createCheckRepliesHandler(boss: PgBoss) {
  return async function handleCheckReplies(
    job: PgBoss.Job | PgBoss.Job[]
  ): Promise<CheckRepliesResult> {
    // pg-boss 10.x passes jobs as array even for single items
    const actualJob = Array.isArray(job) ? job[0] : job;
    void actualJob; // We don't need job data for this handler

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

    let queued = 0;
    let matched = 0;

    // Queue classification jobs
    for (const email of unclassified) {
      try {
        // Try to match email to a contact by from_email
        if (email.from_email) {
          const { data: contact } = await supabase
            .from('contacts')
            .select('id, company_id')
            .eq('email', email.from_email.toLowerCase())
            .limit(1)
            .single();

          if (contact) {
            // Update synced_email with matched contact/company
            await supabase
              .from('synced_emails')
              .update({
                matched_contact_id: contact.id,
                matched_company_id: contact.company_id,
              })
              .eq('id', email.id);

            matched++;
            console.log(`[check-replies] Matched ${email.from_email} to contact ${contact.id}`);
          }
        }

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

    console.log(`[check-replies] Matched ${matched} emails to contacts`);

    console.log(`[check-replies] Queued ${queued} emails for classification`);

    return {
      success: true,
      unclassifiedCount,
      queuedForClassification: queued,
    };
  };
}
