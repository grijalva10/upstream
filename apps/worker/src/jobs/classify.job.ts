import PgBoss from 'pg-boss';
import { spawn } from 'child_process';
import { supabase } from '../db.js';
import { config } from '../config.js';

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
  job: PgBoss.Job<ClassifyEmailPayload>
): Promise<ClassifyResult> {
  const { emailId } = job.data;
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

  if (config.dryRun) {
    console.log('[classify] DRY RUN - skipping actual classification');
    return {
      success: true,
      emailId,
      classification: 'dry_run',
      confidence: 1.0,
    };
  }

  // Build the classification prompt
  const prompt = `You are the response-classifier agent. Classify this email response.

From: ${email.from_email}
Subject: ${email.subject}
Body:
${email.body_text?.substring(0, 3000) || '(empty)'}

Classify into one of these categories:
- interested: Shows interest in discussing property
- pricing_given: Provides asking price, NOI, cap rate
- question: Asks a question needing answer
- referral: Refers to someone else to contact
- broker_redirect: Says to contact their broker
- soft_pass: Polite decline, may re-engage later
- hard_pass: Firm decline, do not contact again
- bounce: Delivery failure, invalid email

Return JSON only:
{
  "category": "one_of_the_above",
  "confidence": 0.0-1.0,
  "extracted_data": { "asking_price": null, "noi": null, "cap_rate": null },
  "reasoning": "brief explanation"
}`;

  try {
    // Run Claude Code headless
    const result = await runClaudeClassify(prompt);

    // Parse result
    const parsed = JSON.parse(result);

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

async function runClaudeClassify(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Use claude CLI in headless mode
    const proc = spawn('claude', ['-p', prompt, '--output-format', 'json'], {
      cwd: config.python.projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      env: {
        ...process.env,
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        // Try to extract JSON from the output
        try {
          // Claude might wrap the JSON in markdown code blocks
          const jsonMatch = stdout.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            resolve(jsonMatch[0]);
          } else {
            resolve(stdout.trim());
          }
        } catch {
          resolve(stdout.trim());
        }
      } else {
        reject(new Error(stderr || stdout || `Exit code ${code}`));
      }
    });

    proc.on('error', (error) => {
      reject(error);
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('Classification timeout'));
    }, 2 * 60 * 1000);
  });
}
