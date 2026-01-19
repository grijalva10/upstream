/**
 * Auto Follow-Up Job
 *
 * Automatically sends follow-up emails for:
 * 1. Documents promised but not received (3 days)
 * 2. OOO contacts after return date
 *
 * Runs daily and generates friendly follow-up messages via Claude.
 */

import PgBoss from 'pg-boss';
import { supabase } from '../db.js';
import { config } from '../config.js';
import { runSimple } from '@upstream/claude-cli';

export interface AutoFollowUpResult {
  docFollowUps: number;
  oooFollowUps: number;
  errors: number;
}

export function createAutoFollowUpHandler(boss: PgBoss) {
  return async function handleAutoFollowUp(
    job: PgBoss.Job | PgBoss.Job[]
  ): Promise<AutoFollowUpResult> {
    const actualJob = Array.isArray(job) ? job[0] : job;
    void actualJob;

    console.log('[auto-follow-up] Starting auto follow-up processing...');

    if (!config.jobs.autoFollowUp) {
      console.log('[auto-follow-up] Job disabled - skipping');
      return { docFollowUps: 0, oooFollowUps: 0, errors: 0 };
    }

    let docFollowUps = 0;
    let oooFollowUps = 0;
    let errors = 0;

    // 1. Document follow-ups using the view
    try {
      const { data: pendingDocs, error } = await supabase
        .from('pending_doc_follow_ups')
        .select('*')
        .limit(20);

      if (error) {
        console.error('[auto-follow-up] Failed to query pending docs:', error.message);
      } else if (pendingDocs && pendingDocs.length > 0) {
        console.log(`[auto-follow-up] Found ${pendingDocs.length} pending doc follow-ups`);

        for (const pending of pendingDocs) {
          try {
            await sendDocFollowUp(pending, boss);
            docFollowUps++;
          } catch (err) {
            console.error(`[auto-follow-up] Failed to send doc follow-up:`, err);
            errors++;
          }
        }
      }
    } catch (err) {
      console.error('[auto-follow-up] Doc follow-up error:', err);
      errors++;
    }

    // 2. OOO follow-ups (contacts who returned from OOO)
    try {
      const { data: oooTasks, error } = await supabase
        .from('tasks')
        .select(`
          id,
          contact_id,
          lead_id,
          property_id,
          title,
          description,
          contacts!inner(id, name, email, lead_id)
        `)
        .eq('type', 'ooo_follow_up')
        .eq('status', 'pending')
        .lte('due_date', new Date().toISOString().split('T')[0])
        .limit(10);

      if (error) {
        console.error('[auto-follow-up] Failed to query OOO tasks:', error.message);
      } else if (oooTasks && oooTasks.length > 0) {
        console.log(`[auto-follow-up] Found ${oooTasks.length} OOO follow-ups due`);

        for (const task of oooTasks) {
          try {
            await sendOOOFollowUp(task, boss);
            oooFollowUps++;

            // Mark task completed
            await supabase
              .from('tasks')
              .update({ status: 'completed', completed_at: new Date().toISOString() })
              .eq('id', task.id);
          } catch (err) {
            console.error(`[auto-follow-up] Failed to send OOO follow-up:`, err);
            errors++;
          }
        }
      }
    } catch (err) {
      console.error('[auto-follow-up] OOO follow-up error:', err);
      errors++;
    }

    console.log(
      `[auto-follow-up] Complete: ${docFollowUps} doc follow-ups, ${oooFollowUps} OOO follow-ups, ${errors} errors`
    );

    return { docFollowUps, oooFollowUps, errors };
  };
}

async function sendDocFollowUp(
  pending: {
    id: string;
    lead_id: string;
    property_id: string;
    contact_name: string;
    contact_email: string;
    lead_name: string;
    property_address: string;
    pending_rent_roll: string | null;
    pending_op_statement: string | null;
    follow_up_count: number;
  },
  boss: PgBoss
): Promise<void> {
  const pendingDocs: string[] = [];
  if (pending.pending_rent_roll) pendingDocs.push('rent roll');
  if (pending.pending_op_statement) pendingDocs.push('operating statement');

  if (pendingDocs.length === 0) return;

  // Generate follow-up message with Claude
  const prompt = `Write a short, friendly follow-up email asking about documents.

Context:
- Contact: ${pending.contact_name}
- Lead: ${pending.lead_name}
- Property: ${pending.property_address || 'the property'}
- Waiting on: ${pendingDocs.join(' and ')}
- This is follow-up #${pending.follow_up_count + 1}

Rules:
- Keep it to 2-3 sentences max
- Be casual and friendly, not pushy
- Don't use a greeting line like "Hi [Name]" - just start with the message
- Don't include a signature - Outlook adds it automatically
- If follow-up #2+, acknowledge you're following up again

Output ONLY the email body text, nothing else.`;

  const draft = await runSimple(prompt, { cwd: config.python.projectRoot });

  // Queue the email
  await boss.send('send-email', {
    queueId: crypto.randomUUID(),
    toEmail: pending.contact_email,
    toName: pending.contact_name,
    subject: `Re: ${pending.property_address || pending.lead_name}`,
    bodyText: draft.trim(),
    priority: 2,
    jobType: 'follow_up',
  });

  // Update qualification data
  await supabase
    .from('qualification_data')
    .update({
      last_follow_up_at: new Date().toISOString(),
      follow_up_count: pending.follow_up_count + 1,
    })
    .eq('id', pending.id);

  console.log(`[auto-follow-up] Sent doc follow-up to ${pending.contact_email}`);
}

async function sendOOOFollowUp(
  task: {
    id: string;
    contact_id: string;
    lead_id: string;
    property_id: string | null;
    title: string;
    description: string;
    contacts: { id: string; name: string; email: string; lead_id: string };
  },
  boss: PgBoss
): Promise<void> {
  const contact = task.contacts;

  // Get property info if available
  let propertyAddress = '';
  if (task.property_id) {
    const { data: property } = await supabase
      .from('properties')
      .select('address')
      .eq('id', task.property_id)
      .single();
    propertyAddress = property?.address || '';
  }

  // Generate follow-up message
  const prompt = `Write a short follow-up email for someone who was previously out of office.

Context:
- Contact: ${contact.name}
- Property: ${propertyAddress || 'their property'}
- They were previously OOO and should be back now

Rules:
- Keep it to 2-3 sentences
- Acknowledge they were away, welcome them back briefly
- Gently re-engage on the property discussion
- Don't use a greeting line - just start with the message
- Don't include a signature

Output ONLY the email body text.`;

  const draft = await runSimple(prompt, { cwd: config.python.projectRoot });

  // Queue the email
  await boss.send('send-email', {
    queueId: crypto.randomUUID(),
    toEmail: contact.email,
    toName: contact.name,
    subject: `Re: ${propertyAddress || 'Following up'}`,
    bodyText: draft.trim(),
    priority: 2,
    jobType: 'follow_up',
  });

  console.log(`[auto-follow-up] Sent OOO follow-up to ${contact.email}`);
}

