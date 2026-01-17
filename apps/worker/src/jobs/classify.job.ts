import PgBoss from 'pg-boss';
import { supabase } from '../db.js';
import { config } from '../config.js';
import { runSimple } from '@upstream/claude-cli';

export interface ClassifyEmailPayload {
  emailId: string;
  fromEmail?: string;
  subject?: string;
  bodyPreview?: string;
}

export interface ClassifyResult {
  success: boolean;
  emailId: string;
  classification?: string;
  confidence?: number;
  error?: string;
}

export async function handleClassify(
  job: PgBoss.Job<ClassifyEmailPayload> | PgBoss.Job<ClassifyEmailPayload>[]
): Promise<ClassifyResult> {
  // pg-boss 10.x passes jobs as array even for single items
  const actualJob = Array.isArray(job) ? job[0] : job;
  const { emailId } = actualJob.data;
  console.log(`[classify] Classifying email ${emailId}`);

  // Fetch full email content
  const { data: email, error: fetchError } = await supabase
    .from('synced_emails')
    .select('*')
    .eq('id', emailId)
    .single();

  if (fetchError || !email) {
    console.error(`[classify] Email not found: ${emailId}`);
    return {
      success: false,
      emailId,
      error: fetchError?.message || 'Email not found',
    };
  }

  // Skip if already classified
  if (email.classification) {
    console.log(`[classify] Already classified: ${email.classification}`);
    return {
      success: true,
      emailId,
      classification: email.classification,
      confidence: email.classification_confidence,
    };
  }

  // Build the classification prompt - strict JSON-only format
  const prompt = `Classify this email. Output ONLY valid JSON, no other text.

EMAIL:
From: ${email.from_email}
Subject: ${email.subject}
Body: ${email.body_text?.substring(0, 2000) || '(empty)'}

CATEGORIES:
- interested: Shows interest in property discussion
- pricing_given: Provides price, NOI, or cap rate
- question: Asks a question
- referral: Refers to someone else
- broker_redirect: Says contact their broker
- soft_pass: Polite decline
- hard_pass: Firm decline, do not contact
- bounce: Delivery failure

OUTPUT FORMAT (JSON only, no markdown, no explanation):
{"category":"<category>","confidence":<0.0-1.0>,"extracted_data":{"asking_price":null,"noi":null,"cap_rate":null},"reasoning":"<brief>"}`;

  try {
    // Check if email is matched to a contact - skip if not
    if (!email.matched_contact_id) {
      console.log(`[classify] Skipping ${emailId} - no matched contact`);
      await supabase
        .from('synced_emails')
        .update({ needs_human_review: false })
        .eq('id', emailId);
      return {
        success: true,
        emailId,
        classification: 'skipped',
      };
    }

    // Run Claude Code headless via @upstream/claude-cli
    const result = await runSimple(prompt, {
      cwd: config.python.projectRoot,
      timeout: 2 * 60 * 1000,
    });

    // Try to extract JSON from result (Claude might wrap it in markdown or prose)
    let jsonStr = result;

    // Try to find JSON object in the response
    const jsonMatch = result.match(/\{[\s\S]*"category"[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    // Parse result
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error(`[classify] Failed to parse JSON from: ${result.substring(0, 200)}`);
      // Mark for human review and return success (don't retry)
      await supabase
        .from('synced_emails')
        .update({ needs_human_review: true, review_reason: 'classification_parse_error' })
        .eq('id', emailId);
      return {
        success: true,
        emailId,
        error: 'Failed to parse classification response',
      };
    }

    // Update the email record
    const { error: updateError } = await supabase
      .from('synced_emails')
      .update({
        classification: parsed.category,
        classification_confidence: parsed.confidence,
        extracted_pricing: parsed.extracted_data,
        classified_at: new Date().toISOString(),
        classified_by: 'classify-job',
        needs_human_review: parsed.confidence < 0.7,
      })
      .eq('id', emailId);

    if (updateError) {
      console.error(`[classify] Update failed: ${updateError.message}`);
      throw new Error(updateError.message);
    }

    console.log(`[classify] Classified as ${parsed.category} (${parsed.confidence})`);

    // Update company status to 'engaged' if they replied (any classification except bounce)
    if (parsed.category !== 'bounce' && email.matched_company_id) {
      const { error: companyError } = await supabase
        .from('companies')
        .update({ status: 'engaged' })
        .eq('id', email.matched_company_id)
        .eq('status', 'contacted');

      if (!companyError) {
        console.log(`[classify] Updated company ${email.matched_company_id} status to 'engaged'`);
      }
    }

    return {
      success: true,
      emailId,
      classification: parsed.category,
      confidence: parsed.confidence,
    };
  } catch (error) {
    console.error(`[classify] Classification failed:`, error);

    // Mark for human review
    await supabase
      .from('synced_emails')
      .update({ needs_human_review: true })
      .eq('id', emailId);

    throw error;
  }
}
