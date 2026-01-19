/**
 * Unified Reply Processing Job - SIMPLIFIED
 *
 * Handles all inbound email classification with 5 simple categories.
 * NEVER auto-sends emails - always creates drafts for human approval.
 *
 * Classification Categories:
 * - hot: Interested, wants to talk, gave pricing, wants to schedule
 * - question: Asking about deal/buyer/terms, wants docs
 * - pass: Not interested, wrong person, has broker, DNC
 * - bounce: Delivery failure
 * - other: OOO, general, unclear, internal, newsletter
 */

import PgBoss from 'pg-boss';
import { supabase } from '../db.js';
import { config } from '../config.js';
import { runBatch } from '@upstream/claude-cli';

// =============================================================================
// SENDER TYPE DETECTION (Pre-filter before AI classification)
// =============================================================================

const SKIP_DOMAINS = new Set([
  // CoStar and data providers
  'alerts.costar.com',
  'email.costar.com',
  'costar.com',
  'loopnet.com',
  'crexi.com',
  'reonomy.com',
  // Platform notifications
  'crowdstreet.com',
  'txn.dropbox.com',
  'sharepointonline.com',
  'n8n.io',
  'close.com',
  'stripe.com',
  'docusign.net',
  'adobe.com',
  // CRE newsletters
  'socalccim.com',
  'ccim.com',
  'crediblecre.com',
  'bisnow.com',
  'globest.com',
  // System addresses
  'noreply',
  'no-reply',
  'mailer-daemon',
  'postmaster',
]);

const INTERNAL_DOMAIN = 'lee-associates.com';

const SKIP_SUBJECT_PATTERNS = [
  /daily alert/i,
  /newsletter/i,
  /digest/i,
  /security:/i,
  /quarantine/i,
  /unsubscribe/i,
  /weekly report/i,
  /market update/i,
];

type SenderType = 'known_contact' | 'internal_team' | 'newsletter' | 'bounce' | 'unknown_external';

function detectSenderType(fromEmail: string, subject: string = ''): SenderType {
  if (!fromEmail) return 'newsletter';

  const emailLower = fromEmail.toLowerCase();
  const domain = emailLower.split('@')[1] || '';

  if (emailLower.includes('postmaster') || emailLower.includes('mailer-daemon')) {
    return 'bounce';
  }

  if (domain === INTERNAL_DOMAIN || emailLower.includes(INTERNAL_DOMAIN)) {
    return 'internal_team';
  }

  for (const skipDomain of SKIP_DOMAINS) {
    if (domain.includes(skipDomain) || emailLower.includes(skipDomain)) {
      return 'newsletter';
    }
  }

  for (const pattern of SKIP_SUBJECT_PATTERNS) {
    if (pattern.test(subject)) {
      return 'newsletter';
    }
  }

  return 'unknown_external';
}

// =============================================================================
// TYPES - SIMPLIFIED TO 5 CLASSIFICATIONS
// =============================================================================

export type Classification = 'hot' | 'question' | 'pass' | 'bounce' | 'other';

interface ExtractedData {
  phone?: string;
  asking_price?: number;
  noi?: number;
  cap_rate?: number;
  referral_name?: string;
  referral_email?: string;
  return_date?: string; // For OOO
  reason?: string; // Why they passed, or what they're asking
}

interface ClassificationResult {
  classification: Classification;
  confidence: number;
  extracted: ExtractedData;
  draft_reply?: string;
  reasoning: string;
}

interface EmailRecord {
  id: string;
  from_email: string;
  from_name?: string;
  subject?: string;
  body_text?: string;
  received_at: string;
  matched_contact_id?: string;
  matched_lead_id?: string;
}

interface ContactRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  lead_id: string;
}

interface LeadRecord {
  id: string;
  name: string;
  status: string;
}

interface PropertyRecord {
  id: string;
  address: string;
  property_type?: string;
  building_size_sqft?: number;
}

interface LoanRecord {
  maturity_date?: string;
  ltv_current?: number;
  dscr_current?: number;
  special_servicing_status?: string;
  payment_status?: string;
}

interface DealRecord {
  id: string;
  status: string;
  asking_price?: number;
  noi?: number;
  cap_rate?: number;
}

// =============================================================================
// MAIN JOB HANDLER
// =============================================================================

export function createProcessRepliesHandler(boss: PgBoss) {
  return async function handleProcessReplies(
    job: PgBoss.Job | PgBoss.Job[]
  ): Promise<{ processed: number; errors: number }> {
    const actualJob = Array.isArray(job) ? job[0] : job;
    void actualJob;

    console.log('[process-replies] Starting reply processing...');

    if (!config.jobs.processReplies) {
      console.log('[process-replies] Job disabled - skipping');
      return { processed: 0, errors: 0 };
    }

    // Fetch unclassified inbound emails
    const { data: emails, error: fetchError } = await supabase
      .from('synced_emails')
      .select('*')
      .eq('direction', 'inbound')
      .is('classification', null)
      .order('received_at', { ascending: true })
      .limit(20);

    if (fetchError) {
      console.error('[process-replies] Failed to fetch emails:', fetchError.message);
      throw new Error(fetchError.message);
    }

    if (!emails || emails.length === 0) {
      console.log('[process-replies] No unclassified emails found');
      return { processed: 0, errors: 0 };
    }

    console.log(`[process-replies] Found ${emails.length} emails to process`);

    let processed = 0;
    let errors = 0;

    for (const email of emails) {
      try {
        await processEmail(email as EmailRecord);
        processed++;
      } catch (err) {
        console.error(`[process-replies] Failed to process ${email.id}:`, err);
        errors++;

        // Mark for human review on error
        await supabase
          .from('synced_emails')
          .update({
            needs_review: true,
            classification: 'other',
            classified_at: new Date().toISOString(),
          })
          .eq('id', email.id);
      }
    }

    console.log(`[process-replies] Processed ${processed}, errors ${errors}`);
    return { processed, errors };
  };
}

// =============================================================================
// EMAIL PROCESSING
// =============================================================================

async function processEmail(email: EmailRecord): Promise<void> {
  console.log(`[process-replies] Processing email ${email.id} from ${email.from_email}`);

  // Step 0: Pre-filter by sender type
  const senderType = detectSenderType(email.from_email, email.subject || '');

  // Handle newsletters - classify as 'other' and skip
  if (senderType === 'newsletter') {
    console.log(`[process-replies] Auto-skipping newsletter from ${email.from_email}`);
    await supabase
      .from('synced_emails')
      .update({
        classification: 'other',
        classification_confidence: 1.0,
        classified_at: new Date().toISOString(),
        classified_by: 'process-replies-autofilter',
        needs_review: false,
      })
      .eq('id', email.id);
    return;
  }

  // Handle internal team - classify as 'other' but keep visible
  if (senderType === 'internal_team') {
    console.log(`[process-replies] Classifying internal email from ${email.from_email}`);
    await supabase
      .from('synced_emails')
      .update({
        classification: 'other',
        classification_confidence: 1.0,
        classified_at: new Date().toISOString(),
        classified_by: 'process-replies-autofilter',
        needs_review: false,
        status: 'new',
      })
      .eq('id', email.id);
    return;
  }

  // Handle bounces
  if (senderType === 'bounce') {
    console.log(`[process-replies] Auto-detecting bounce from ${email.from_email}`);
    await supabase
      .from('synced_emails')
      .update({
        classification: 'bounce',
        classification_confidence: 1.0,
        classified_at: new Date().toISOString(),
        classified_by: 'process-replies-autofilter',
        needs_review: false,
      })
      .eq('id', email.id);

    // Extract and add bounced address to exclusions
    const originalEmail = extractBounceRecipient(email.subject || '', email.body_text || '');
    if (originalEmail) {
      await supabase
        .from('email_exclusions')
        .upsert({
          email: originalEmail.toLowerCase(),
          reason: 'bounce',
          source_email_id: email.id,
        })
        .select();
      console.log(`[process-replies] Added bounced address to exclusions: ${originalEmail}`);
    }
    return;
  }

  // Step 1: Match to contact if not already matched
  let contact: ContactRecord | null = null;
  let lead: LeadRecord | null = null;
  let property: PropertyRecord | null = null;
  let loan: LoanRecord | null = null;
  let deal: DealRecord | null = null;

  if (!email.matched_contact_id) {
    const { data: contactMatch } = await supabase
      .from('contacts')
      .select('id, name, email, phone, lead_id')
      .eq('email', email.from_email.toLowerCase())
      .single();

    if (contactMatch) {
      contact = contactMatch as ContactRecord;
      await supabase
        .from('synced_emails')
        .update({
          matched_contact_id: contact.id,
          matched_lead_id: contact.lead_id,
        })
        .eq('id', email.id);

      email.matched_contact_id = contact.id;
      email.matched_lead_id = contact.lead_id;
    }
  } else {
    const { data: contactData } = await supabase
      .from('contacts')
      .select('id, name, email, phone, lead_id')
      .eq('id', email.matched_contact_id)
      .single();

    contact = contactData as ContactRecord;
  }

  // Fetch lead
  if (contact?.lead_id) {
    const { data: leadData } = await supabase
      .from('leads')
      .select('id, name, status')
      .eq('id', contact.lead_id)
      .single();

    lead = leadData as LeadRecord;
  }

  // Fetch property (via property_leads)
  if (lead) {
    const { data: propertyLink } = await supabase
      .from('property_leads')
      .select('property_id')
      .eq('lead_id', lead.id)
      .limit(1)
      .single();

    if (propertyLink?.property_id) {
      const { data: propertyData } = await supabase
        .from('properties')
        .select('id, address, property_type, building_size_sqft')
        .eq('id', propertyLink.property_id)
        .single();

      property = propertyData as PropertyRecord;

      // Fetch loan data
      const { data: loanData } = await supabase
        .from('property_loans')
        .select('maturity_date, ltv_current, dscr_current, special_servicing_status, payment_status')
        .eq('property_id', property.id)
        .limit(1)
        .single();

      loan = loanData as LoanRecord;

      // Fetch deal data
      const { data: dealData } = await supabase
        .from('deals')
        .select('id, status, asking_price, noi, cap_rate')
        .eq('property_id', property.id)
        .eq('lead_id', lead.id)
        .single();

      deal = dealData as DealRecord;
    }
  }

  // Step 2: Get thread context (last few emails)
  const { data: threadEmails } = await supabase
    .from('synced_emails')
    .select('from_email, subject, body_text, classification, received_at')
    .or(
      contact?.id
        ? `matched_contact_id.eq.${contact.id},from_email.eq.${email.from_email}`
        : `from_email.eq.${email.from_email}`
    )
    .order('received_at', { ascending: false })
    .limit(5);

  const threadSummary = (threadEmails || [])
    .map((e) => `[${e.from_email}]: ${e.body_text?.substring(0, 200) || ''}`)
    .join('\n');

  // Step 3: Run classification with Claude
  const result = await classifyEmail(email, contact, lead, property, loan, deal, threadSummary);

  // Step 4: Update email record
  await supabase
    .from('synced_emails')
    .update({
      classification: result.classification,
      classification_confidence: result.confidence,
      extracted_pricing: {
        asking_price: result.extracted.asking_price,
        noi: result.extracted.noi,
        cap_rate: result.extracted.cap_rate,
        phone: result.extracted.phone,
      },
      classified_at: new Date().toISOString(),
      classified_by: 'process-replies',
      needs_review: result.confidence < 0.7,
    })
    .eq('id', email.id);

  console.log(
    `[process-replies] Classified as ${result.classification} (${result.confidence}) - ${result.reasoning}`
  );

  // Step 5: Execute action based on classification
  await executeAction(result, email, contact, lead, property, deal);
}

// =============================================================================
// CLASSIFICATION PROMPT - SIMPLIFIED
// =============================================================================

async function classifyEmail(
  email: EmailRecord,
  contact: ContactRecord | null,
  lead: LeadRecord | null,
  property: PropertyRecord | null,
  loan: LoanRecord | null,
  deal: DealRecord | null,
  threadSummary: string
): Promise<ClassificationResult> {
  const prompt = buildClassificationPrompt(
    email,
    contact,
    lead,
    property,
    loan,
    deal,
    threadSummary
  );

  const result = await runBatch({
    prompt,
    maxTurns: 1,
    timeout: 3 * 60 * 1000,
    cwd: config.python.projectRoot,
  });

  if (!result.success) {
    throw new Error(result.error || 'Claude request failed');
  }

  const rawResult = result.output;
  const jsonMatch = rawResult.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Claude response');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      classification: parsed.classification || 'other',
      confidence: parsed.confidence || 0.5,
      extracted: parsed.extracted || {},
      draft_reply: parsed.draft_reply,
      reasoning: parsed.reasoning || '',
    };
  } catch (err) {
    console.error('[process-replies] Failed to parse JSON:', rawResult.substring(0, 500));
    throw new Error('Failed to parse classification response');
  }
}

function buildClassificationPrompt(
  email: EmailRecord,
  contact: ContactRecord | null,
  lead: LeadRecord | null,
  property: PropertyRecord | null,
  loan: LoanRecord | null,
  deal: DealRecord | null,
  threadSummary: string
): string {
  const propertyContext = property
    ? `
Property: ${property.address}
Type: ${property.property_type || 'Unknown'}
Size: ${property.building_size_sqft?.toLocaleString() || 'Unknown'} SF`
    : 'No property linked';

  const loanContext = loan
    ? `
Loan Maturity: ${loan.maturity_date || 'Unknown'}
LTV: ${loan.ltv_current ? loan.ltv_current + '%' : 'Unknown'}
DSCR: ${loan.dscr_current ? loan.dscr_current + 'x' : 'Unknown'}
Special Servicing: ${loan.special_servicing_status || 'No'}
Payment Status: ${loan.payment_status || 'Current'}`
    : 'No loan data';

  const dealContext = deal
    ? `
Deal Status: ${deal.status}
Asking Price: ${deal.asking_price ? '$' + deal.asking_price.toLocaleString() : 'Unknown'}
NOI: ${deal.noi ? '$' + deal.noi.toLocaleString() : 'Unknown'}
Cap Rate: ${deal.cap_rate ? deal.cap_rate + '%' : 'Unknown'}`
    : 'No deal yet';

  return `You are an email classifier for CRE deal sourcing. Classify this email into ONE of 5 categories.

EMAIL:
From: ${email.from_email} (${contact?.name || email.from_name || 'Unknown'})
Subject: ${email.subject || '(no subject)'}
Body:
${email.body_text?.substring(0, 3000) || '(empty)'}

CONTEXT:
Contact: ${contact?.name || 'Unknown'}${contact?.phone ? ` (${contact.phone})` : ''}
Lead: ${lead?.name || 'Unknown'} (Status: ${lead?.status || 'unknown'})

${propertyContext}

${loanContext}

${dealContext}

RECENT THREAD:
${threadSummary || 'No prior emails'}

CLASSIFICATION OPTIONS (pick exactly one):

1. **hot** - They're interested! This includes:
   - Expressing interest in selling/discussing
   - Giving pricing info (asking price, NOI, cap rate)
   - Wanting to schedule a call ("call me", "let's talk")
   - Confirming a meeting time
   - Sending documents (rent roll, financials)
   - Any positive engagement

2. **question** - They have questions but haven't committed:
   - Asking about the buyer/deal/terms
   - Requesting documents or info from us
   - Clarifying what we're looking for
   - General inquiry without commitment

3. **pass** - Not interested:
   - Explicitly declining ("not interested", "no thanks")
   - Wrong person ("I don't own this", "left the organization")
   - Has a broker ("talk to my broker")
   - Do not contact requests
   - Hostile response

4. **bounce** - Delivery failure:
   - Undeliverable/mailbox full
   - Email doesn't exist
   - Server rejection

5. **other** - Everything else:
   - Out of office
   - General correspondence
   - Unclear intent
   - Auto-replies

RESPOND WITH JSON ONLY:
{
  "classification": "hot|question|pass|bounce|other",
  "confidence": 0.0-1.0,
  "extracted": {
    "phone": null,
    "asking_price": null,
    "noi": null,
    "cap_rate": null,
    "referral_name": null,
    "referral_email": null,
    "return_date": null,
    "reason": null
  },
  "draft_reply": "Your suggested reply or null",
  "reasoning": "Brief explanation"
}

RULES:
- Extract pricing (asking price, NOI, cap rate) if mentioned
- Extract phone number if they provide one
- For hot: ALWAYS draft a reply to continue the conversation
- For question: Draft an answer to their question
- For pass: No reply needed, extract reason
- For bounce/other: No reply needed
- Keep draft replies SHORT and professional, no signature
- If unsure, default to "other"`;
}

// =============================================================================
// ACTION EXECUTION - SIMPLIFIED
// =============================================================================

async function executeAction(
  result: ClassificationResult,
  email: EmailRecord,
  contact: ContactRecord | null,
  lead: LeadRecord | null,
  property: PropertyRecord | null,
  deal: DealRecord | null
): Promise<void> {
  const { classification, extracted, draft_reply } = result;

  switch (classification) {
    case 'hot':
      await handleHot(result, email, contact, lead, property, deal);
      break;

    case 'question':
      await handleQuestion(result, email, contact);
      break;

    case 'pass':
      await handlePass(result, email, contact, lead, deal);
      break;

    case 'bounce':
      await handleBounce(email, contact);
      break;

    case 'other':
      // No action needed, just logged
      break;
  }
}

// =============================================================================
// ACTION HANDLERS - SIMPLIFIED
// =============================================================================

async function handleHot(
  result: ClassificationResult,
  email: EmailRecord,
  contact: ContactRecord | null,
  lead: LeadRecord | null,
  property: PropertyRecord | null,
  deal: DealRecord | null
): Promise<void> {
  // Update lead status to engaged
  if (lead && lead.status === 'contacted') {
    await supabase
      .from('leads')
      .update({ status: 'engaged', status_changed_at: new Date().toISOString() })
      .eq('id', lead.id);
  }

  // Update contact phone if extracted
  if (result.extracted.phone && contact) {
    await supabase.from('contacts').update({ phone: result.extracted.phone }).eq('id', contact.id);
  }

  // Update deal with extracted pricing
  if (deal && (result.extracted.asking_price || result.extracted.noi || result.extracted.cap_rate)) {
    const updates: Record<string, unknown> = {
      last_response_at: new Date().toISOString(),
    };
    if (result.extracted.asking_price) updates.asking_price = result.extracted.asking_price;
    if (result.extracted.noi) updates.noi = result.extracted.noi;
    if (result.extracted.cap_rate) updates.cap_rate = result.extracted.cap_rate;

    await supabase.from('deals').update(updates).eq('id', deal.id);
  }

  // ALWAYS create draft - never auto-send
  if (result.draft_reply && contact) {
    await createDraft(email, contact, result.draft_reply, 'hot_response', lead, property);
  }
}

async function handleQuestion(
  result: ClassificationResult,
  email: EmailRecord,
  contact: ContactRecord | null
): Promise<void> {
  // Create draft answer
  if (result.draft_reply && contact) {
    await createDraft(email, contact, result.draft_reply, 'question_answer');
  }
}

async function handlePass(
  result: ClassificationResult,
  email: EmailRecord,
  contact: ContactRecord | null,
  lead: LeadRecord | null,
  deal: DealRecord | null
): Promise<void> {
  // Update deal status to lost
  if (deal) {
    await supabase
      .from('deals')
      .update({
        status: 'lost',
        notes: result.extracted.reason || result.reasoning,
        updated_at: new Date().toISOString(),
      })
      .eq('id', deal.id);
  }

  // Update lead status
  if (lead) {
    await supabase
      .from('leads')
      .update({ status: 'rejected', status_changed_at: new Date().toISOString() })
      .eq('id', lead.id);
  }

  // Check if this is a hard DNC request
  const reason = result.extracted.reason?.toLowerCase() || result.reasoning.toLowerCase();
  const isDNC =
    reason.includes('remove') ||
    reason.includes('stop') ||
    reason.includes('unsubscribe') ||
    reason.includes('do not contact');

  if (isDNC && contact) {
    await supabase
      .from('dnc_entries')
      .upsert({
        email: email.from_email.toLowerCase(),
        reason: 'requested',
        source: 'email_response',
        source_email_id: email.id,
        notes: result.reasoning,
      })
      .select();

    await supabase
      .from('contacts')
      .update({ status: 'dnc', status_changed_at: new Date().toISOString() })
      .eq('id', contact.id);

    console.log(`[process-replies] Added ${email.from_email} to DNC`);
  }

  // If referral info extracted, create new contact
  if (result.extracted.referral_email && lead) {
    await supabase
      .from('contacts')
      .insert({
        lead_id: lead.id,
        name: result.extracted.referral_name || 'Unknown',
        email: result.extracted.referral_email.toLowerCase(),
        source: 'referral',
      })
      .select()
      .single();

    console.log(`[process-replies] Created referral contact: ${result.extracted.referral_email}`);
  }
}

async function handleBounce(email: EmailRecord, contact: ContactRecord | null): Promise<void> {
  // Add to exclusions
  await supabase
    .from('email_exclusions')
    .upsert({
      email: email.from_email.toLowerCase(),
      reason: 'bounce',
      source_email_id: email.id,
    })
    .select();

  // Update contact status
  if (contact) {
    await supabase
      .from('contacts')
      .update({ status: 'bounced', status_changed_at: new Date().toISOString() })
      .eq('id', contact.id);
  }

  console.log(`[process-replies] Marked ${email.from_email} as bounced`);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function createDraft(
  email: EmailRecord,
  contact: ContactRecord,
  body: string,
  draftType: string,
  lead?: LeadRecord | null,
  property?: PropertyRecord | null
): Promise<void> {
  const subject = email.subject?.startsWith('Re:')
    ? email.subject
    : `Re: ${email.subject || 'Your inquiry'}`;

  await supabase.from('email_drafts').insert({
    to_email: contact.email,
    to_name: contact.name,
    subject,
    body,
    contact_id: contact.id,
    lead_id: lead?.id,
    property_id: property?.id,
    source_email_id: email.id,
    draft_type: draftType,
    status: 'pending',
    generated_by: 'process-replies',
  });

  console.log(`[process-replies] Created draft for review: ${contact.email}`);
}

function extractBounceRecipient(subject: string, body: string): string | null {
  const patterns = [
    /(?:to|recipient|address)[:\s]+<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i,
    /(?:could not be delivered to)[:\s]+<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i,
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
  ];

  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  for (const pattern of patterns) {
    const match = subject.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}
