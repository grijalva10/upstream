/**
 * Unified Reply Processing Job
 *
 * Handles all inbound email classification and autonomous action execution.
 * Consolidates: check-replies + classify + actions into single pipeline.
 *
 * Classification Categories:
 * - hot_interested: Shows interest, wants to engage
 * - hot_schedule: Wants to schedule a call
 * - hot_confirm: Confirming a proposed meeting time
 * - hot_pricing: Provided pricing/deal info
 * - question: Asking about the deal
 * - info_request: Wants documents sent
 * - referral: Redirected to another person
 * - broker: Redirected to broker
 * - ooo: Out of office
 * - soft_pass: Not now, maybe later
 * - hard_pass: Do not contact
 * - wrong_contact: Stale/incorrect contact
 * - bounce: Delivery failure
 * - doc_promised: Said they'll send documents
 * - doc_received: Sent documents/attachments
 * - buyer_inquiry: Wants to buy, not sell
 * - buyer_criteria_update: Adding to buy criteria
 * - general_update: General correspondence
 * - unclear: Cannot determine intent
 */

import PgBoss from 'pg-boss';
import { supabase } from '../db.js';
import { config } from '../config.js';
import { runBatch } from '@upstream/claude-cli';
import {
  getCalendarAvailability,
  createCalendarMeeting,
  CalendarSlot,
} from '../lib/calendar-bridge.js';

// =============================================================================
// SENDER TYPE DETECTION
// =============================================================================

// Domains that should be auto-skipped (newsletters, system emails)
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

// Internal team domain
const INTERNAL_DOMAIN = 'lee-associates.com';

// Subject patterns that indicate newsletters/spam
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

// Sender type for pre-classification routing
type SenderType = 'known_contact' | 'internal_team' | 'newsletter' | 'bounce' | 'unknown_external';

/**
 * Determine sender type before classification
 */
function detectSenderType(fromEmail: string, subject: string = ''): SenderType {
  if (!fromEmail) return 'newsletter'; // No email = skip

  const emailLower = fromEmail.toLowerCase();
  const domain = emailLower.split('@')[1] || '';

  // Check for bounce (postmaster, mailer-daemon)
  if (emailLower.includes('postmaster') || emailLower.includes('mailer-daemon')) {
    return 'bounce';
  }

  // Check for internal team
  if (domain === INTERNAL_DOMAIN || emailLower.includes(INTERNAL_DOMAIN)) {
    return 'internal_team';
  }

  // Check for newsletter/skip domains
  for (const skipDomain of SKIP_DOMAINS) {
    if (domain.includes(skipDomain) || emailLower.includes(skipDomain)) {
      return 'newsletter';
    }
  }

  // Check subject patterns
  for (const pattern of SKIP_SUBJECT_PATTERNS) {
    if (pattern.test(subject)) {
      return 'newsletter';
    }
  }

  return 'unknown_external';
}

// =============================================================================
// TYPES
// =============================================================================

export type Classification =
  | 'hot_interested'
  | 'hot_schedule'
  | 'hot_confirm'
  | 'hot_pricing'
  | 'question'
  | 'info_request'
  | 'referral'
  | 'broker'
  | 'ooo'
  | 'soft_pass'
  | 'hard_pass'
  | 'wrong_contact'
  | 'bounce'
  | 'doc_promised'
  | 'doc_received'
  | 'buyer_inquiry'
  | 'buyer_criteria_update'
  | 'general_update'
  | 'unclear'
  // Auto-filter classifications (set before Claude classification)
  | 'newsletter'
  | 'internal';

interface ExtractedData {
  phone?: string;
  asking_price?: number;
  noi?: number;
  cap_rate?: number;
  return_date?: string;
  selected_slot?: string;
  referral_name?: string;
  referral_email?: string;
  broker_name?: string;
  broker_company?: string;
  doc_requested?: string;
  docs_promised?: string[];
  docs_received?: string[];
  nurture_timeframe?: string;
  buy_criteria?: {
    property_types?: string[];
    markets?: string[];
    submarkets?: string[];
    size_min?: number;
    size_max?: number;
    price_min?: number;
    price_max?: number;
    deal_type?: string;
    timeline?: string;
    exchange_1031?: boolean;
    notes?: string;
  };
  criteria_complete?: boolean;
  missing_fields?: string[];
}

interface ClassificationResult {
  classification: Classification;
  confidence: number;
  extracted: ExtractedData;
  draft_reply?: string;
  attach_doc?: string;
  now_qualified?: boolean;
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
  matched_company_id?: string;
  scheduling_state?: {
    status: 'proposed' | 'awaiting_confirmation' | 'scheduled';
    offered_slots?: string[];
    selected_slot?: string;
    calendar_event_id?: string;
  };
  attachments?: string[];
}

interface ContactRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company_id: string;
}

interface CompanyRecord {
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

interface QualificationRecord {
  id: string;
  company_id: string;
  property_id?: string;
  asking_price?: number;
  noi?: number;
  cap_rate?: number;
  rent_roll_status: string;
  operating_statement_status: string;
  last_response_at?: string;
  follow_up_count: number;
  status: string;
}

interface BuyerCriteriaRecord {
  id: string;
  contact_id: string;
  status: string;
  property_types?: string[];
  markets?: string[];
  submarkets?: string[];
  size_min?: number;
  size_max?: number;
  price_min?: number;
  price_max?: number;
  deal_type?: string;
  timeline?: string;
  exchange_1031?: boolean;
  other_notes?: string;
  missing_fields?: string[];
  search_id?: string;
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
        await processEmail(email as EmailRecord, boss);
        processed++;
      } catch (err) {
        console.error(`[process-replies] Failed to process ${email.id}:`, err);
        errors++;

        // Mark for human review on error
        await supabase
          .from('synced_emails')
          .update({
            needs_human_review: true,
            classification: 'unclear',
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

async function processEmail(email: EmailRecord, boss: PgBoss): Promise<void> {
  console.log(`[process-replies] Processing email ${email.id} from ${email.from_email}`);

  // Step 0: Pre-filter by sender type
  const senderType = detectSenderType(email.from_email, email.subject || '');

  // Handle newsletters and internal emails immediately (no classification needed)
  if (senderType === 'newsletter') {
    console.log(`[process-replies] Auto-skipping newsletter/system email from ${email.from_email}`);
    await supabase
      .from('synced_emails')
      .update({
        classification: 'newsletter',
        classification_confidence: 1.0,
        classified_at: new Date().toISOString(),
        classified_by: 'process-replies-autofilter',
        needs_human_review: false,
      })
      .eq('id', email.id);
    return;
  }

  if (senderType === 'internal_team') {
    // Internal team emails (e.g., @lee-associates.com) are classified as 'internal'
    // but NOT skipped - they show in inbox under "Team" filter and remain available
    // for later AI parsing (Brian's emails contain deal notes, buyer criteria, etc.)
    console.log(`[process-replies] Classifying internal email from ${email.from_email} (not skipping)`);
    await supabase
      .from('synced_emails')
      .update({
        classification: 'internal',
        classification_confidence: 1.0,
        classified_at: new Date().toISOString(),
        classified_by: 'process-replies-autofilter',
        needs_human_review: false,
        status: 'new', // Keep as 'new' so it shows in inbox
      })
      .eq('id', email.id);
    // Don't return - email is classified but still visible in inbox
    // No further action needed for internal emails
    return;
  }

  if (senderType === 'bounce') {
    console.log(`[process-replies] Auto-detecting bounce from ${email.from_email}`);
    await supabase
      .from('synced_emails')
      .update({
        classification: 'bounce',
        classification_confidence: 1.0,
        classified_at: new Date().toISOString(),
        classified_by: 'process-replies-autofilter',
        needs_human_review: false,
      })
      .eq('id', email.id);

    // Add to exclusions - extract original recipient from subject if possible
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
  let company: CompanyRecord | null = null;
  let property: PropertyRecord | null = null;
  let qualification: QualificationRecord | null = null;
  let buyerCriteria: BuyerCriteriaRecord | null = null;
  let isNewContact = false;

  if (!email.matched_contact_id) {
    const { data: contactMatch } = await supabase
      .from('contacts')
      .select('id, name, email, phone, company_id')
      .eq('email', email.from_email.toLowerCase())
      .single();

    if (contactMatch) {
      contact = contactMatch as ContactRecord;

      // Update the synced email with matched contact
      await supabase
        .from('synced_emails')
        .update({
          matched_contact_id: contact.id,
          matched_company_id: contact.company_id,
        })
        .eq('id', email.id);

      email.matched_contact_id = contact.id;
      email.matched_company_id = contact.company_id;
    } else {
      // NEW: No matching contact - still classify the email
      // We'll create a contact after classification if it's actionable
      console.log(`[process-replies] No matching contact for ${email.from_email} - will classify anyway`);
      isNewContact = true;

      // Create a temporary contact record for classification context
      contact = {
        id: '', // Will be created after classification if needed
        name: email.from_name || email.from_email.split('@')[0],
        email: email.from_email.toLowerCase(),
        phone: undefined,
        company_id: '',
      };
    }
  } else {
    // Fetch existing contact
    const { data: contactData } = await supabase
      .from('contacts')
      .select('id, name, email, phone, company_id')
      .eq('id', email.matched_contact_id)
      .single();

    contact = contactData as ContactRecord;
  }

  if (!contact) {
    console.log(`[process-replies] Could not establish contact context, marking for review`);
    await supabase
      .from('synced_emails')
      .update({
        classification: 'unclear',
        needs_human_review: true,
        classified_at: new Date().toISOString(),
      })
      .eq('id', email.id);
    return;
  }

  // Fetch company
  const { data: companyData } = await supabase
    .from('companies')
    .select('id, name, status')
    .eq('id', contact.company_id)
    .single();

  company = companyData as CompanyRecord;

  // Fetch property (if linked through property_companies)
  const { data: propertyLink } = await supabase
    .from('property_companies')
    .select('property_id')
    .eq('company_id', contact.company_id)
    .limit(1)
    .single();

  if (propertyLink?.property_id) {
    const { data: propertyData } = await supabase
      .from('properties')
      .select('id, address, property_type, building_size_sqft')
      .eq('id', propertyLink.property_id)
      .single();

    property = propertyData as PropertyRecord;
  }

  // Fetch qualification data if exists
  if (property) {
    const { data: qualData } = await supabase
      .from('qualification_data')
      .select('*')
      .eq('company_id', contact.company_id)
      .eq('property_id', property.id)
      .single();

    qualification = qualData as QualificationRecord;
  }

  // Fetch buyer criteria tracking if exists
  const { data: buyerData } = await supabase
    .from('buyer_criteria_tracking')
    .select('*')
    .eq('contact_id', contact.id)
    .single();

  buyerCriteria = buyerData as BuyerCriteriaRecord;

  // Step 2: Get thread context (last few emails)
  const { data: threadEmails } = await supabase
    .from('synced_emails')
    .select('from_email, subject, body_text, classification, received_at')
    .or(`matched_contact_id.eq.${contact.id},from_email.eq.${email.from_email}`)
    .order('received_at', { ascending: false })
    .limit(5);

  const threadSummary = (threadEmails || [])
    .map((e) => `[${e.from_email}]: ${e.body_text?.substring(0, 200) || ''}`)
    .join('\n');

  // Step 3: Get calendar availability
  let availableSlots: CalendarSlot[] = [];
  try {
    availableSlots = await getCalendarAvailability(5);
  } catch (err) {
    console.warn('[process-replies] Could not get calendar availability:', err);
  }

  // Step 4: Run classification with Claude
  const result = await classifyEmail(
    email,
    contact,
    company,
    property,
    qualification,
    buyerCriteria,
    threadSummary,
    availableSlots
  );

  // Step 5: Update email record
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
      needs_human_review: result.confidence < 0.7 || result.classification === 'unclear',
    })
    .eq('id', email.id);

  console.log(
    `[process-replies] Classified as ${result.classification} (${result.confidence}) - ${result.reasoning}`
  );

  // Step 5.5: If this is a new contact with an actionable classification, create them
  const ACTIONABLE_CLASSIFICATIONS = new Set([
    'hot_interested',
    'hot_schedule',
    'hot_confirm',
    'hot_pricing',
    'question',
    'info_request',
    'referral',
    'doc_promised',
    'doc_received',
    'buyer_inquiry',
    'buyer_criteria_update',
  ]);

  if (isNewContact && ACTIONABLE_CLASSIFICATIONS.has(result.classification)) {
    console.log(`[process-replies] Creating contact for actionable email from ${email.from_email}`);
    try {
      const { contact: newContact, company: newCompany } = await createContactForSender(
        email,
        result.classification
      );

      // Update our local references
      contact = newContact;
      company = newCompany;

      // Update the synced email with the new contact
      await supabase
        .from('synced_emails')
        .update({
          matched_contact_id: contact.id,
          matched_company_id: company?.id,
        })
        .eq('id', email.id);

      email.matched_contact_id = contact.id;
      email.matched_company_id = company?.id;
    } catch (err) {
      console.error(`[process-replies] Failed to create contact:`, err);
      // Continue anyway - we still classified the email
    }
  }

  // For non-actionable classifications from unknown senders, just mark as classified
  // but don't execute actions (no contact to act on)
  if (isNewContact && !ACTIONABLE_CLASSIFICATIONS.has(result.classification)) {
    console.log(`[process-replies] Non-actionable email from unknown sender, skipping action execution`);
    return;
  }

  // Step 6: Execute action based on classification
  await executeAction(
    result,
    email,
    contact,
    company,
    property,
    qualification,
    buyerCriteria,
    availableSlots,
    boss
  );
}

// =============================================================================
// CLASSIFICATION PROMPT
// =============================================================================

async function classifyEmail(
  email: EmailRecord,
  contact: ContactRecord,
  company: CompanyRecord | null,
  property: PropertyRecord | null,
  qualification: QualificationRecord | null,
  buyerCriteria: BuyerCriteriaRecord | null,
  threadSummary: string,
  availableSlots: CalendarSlot[]
): Promise<ClassificationResult> {
  const prompt = buildClassificationPrompt(
    email,
    contact,
    company,
    property,
    qualification,
    buyerCriteria,
    threadSummary,
    availableSlots
  );

  // Use longer timeout for classification (3 minutes)
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

  // Parse JSON from response
  const jsonMatch = rawResult.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Claude response');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      classification: parsed.classification || 'unclear',
      confidence: parsed.confidence || 0.5,
      extracted: parsed.extracted || {},
      draft_reply: parsed.draft_reply,
      attach_doc: parsed.attach_doc,
      now_qualified: parsed.now_qualified,
      reasoning: parsed.reasoning || '',
    };
  } catch (err) {
    console.error('[process-replies] Failed to parse JSON:', rawResult.substring(0, 500));
    throw new Error('Failed to parse classification response');
  }
}

function buildClassificationPrompt(
  email: EmailRecord,
  contact: ContactRecord,
  company: CompanyRecord | null,
  property: PropertyRecord | null,
  qualification: QualificationRecord | null,
  buyerCriteria: BuyerCriteriaRecord | null,
  threadSummary: string,
  availableSlots: CalendarSlot[]
): string {
  const slotsDisplay =
    availableSlots.length > 0
      ? availableSlots.map((s) => `- ${s.display}`).join('\n')
      : 'Calendar unavailable';

  // Determine if this is a known or unknown contact
  const isKnownContact = contact.id && contact.id.length > 0;
  const contactStatus = isKnownContact
    ? `KNOWN CONTACT (in our CRM)`
    : `UNKNOWN SENDER (not in our CRM - could be new prospect, unsolicited, or spam)`;

  const qualDisplay = qualification
    ? `
Qualification State:
- Asking Price: ${qualification.asking_price || 'Unknown'}
- NOI: ${qualification.noi || 'Unknown'}
- Cap Rate: ${qualification.cap_rate || 'Unknown'}
- Rent Roll: ${qualification.rent_roll_status}
- Operating Statement: ${qualification.operating_statement_status}
- Status: ${qualification.status}`
    : 'No qualification data yet';

  const buyerDisplay = buyerCriteria
    ? `
Buyer Criteria Gathering (in progress):
- Property Types: ${buyerCriteria.property_types?.join(', ') || 'Unknown'}
- Markets: ${buyerCriteria.markets?.join(', ') || 'Unknown'}
- Size: ${buyerCriteria.size_min || '?'} - ${buyerCriteria.size_max || '?'} SF
- Price: $${buyerCriteria.price_min || '?'} - $${buyerCriteria.price_max || '?'}
- Missing: ${buyerCriteria.missing_fields?.join(', ') || 'None'}
- Status: ${buyerCriteria.status}`
    : 'Not a buyer inquiry';

  const schedulingDisplay = email.scheduling_state
    ? `
Pending Scheduling:
- Status: ${email.scheduling_state.status}
- Offered Slots: ${email.scheduling_state.offered_slots?.join(', ') || 'None'}`
    : 'No pending scheduling';

  return `You are an autonomous email handler for CRE deal sourcing. Classify this email and determine the appropriate action.

EMAIL:
From: ${email.from_email} (${contact.name})
Subject: ${email.subject || '(no subject)'}
Body: ${email.body_text?.substring(0, 3000) || '(empty)'}
Attachments: ${email.attachments?.join(', ') || 'None'}

CONTACT STATUS: ${contactStatus}

CONTEXT:
Contact: ${contact.name}${contact.phone ? ` (${contact.phone})` : ''}
Company: ${company?.name || 'Unknown'} (Status: ${company?.status || 'unknown'})
Property: ${property?.address || 'N/A'}${property ? ` (${property.property_type}, ${property.building_size_sqft} SF)` : ''}

${qualDisplay}

${buyerDisplay}

${schedulingDisplay}

MY CALENDAR (next 5 business days):
${slotsDisplay}

RECENT THREAD:
${threadSummary || 'No prior emails'}

CLASSIFICATION OPTIONS:
- hot_interested: Shows clear interest, wants to engage or learn more
- hot_schedule: Explicitly wants a call ("call me", "let's talk", provides phone)
- hot_confirm: Confirming a specific time from slots I proposed
- hot_pricing: Provided asking price, NOI, cap rate, or deal terms
- question: Asking about the deal, buyer, timeline, or terms
- info_request: Wants me to send documents (buyer profile, criteria, etc.)
- referral: Gave another person's contact info to reach out to
- broker: Redirected to their broker or listing agent
- ooo: Out of office auto-reply with return date
- soft_pass: Not interested now but door open ("not at this time", "maybe later")
- hard_pass: Firm opt-out ("remove me", "stop emailing", hostile)
- wrong_contact: No longer owns property, left company, wrong person
- bounce: Email delivery failure (postmaster, undeliverable)
- doc_promised: Said they'll send rent roll, financials, or other docs
- doc_received: Actually sent/attached documents
- buyer_inquiry: They want to BUY, not sell (flips the relationship)
- buyer_criteria_update: Providing more details about their buy criteria
- general_update: Casual check-in, no specific action needed
- unclear: Cannot determine intent, needs human review

QUALIFICATION RULES:
- Need 2 of 3: asking_price, noi, cap_rate (verbal/written OK)
- Plus: rent_roll document (received)
- Plus: operating_statement/T12 document (received)

RESPOND WITH JSON ONLY (no markdown, no explanation outside JSON):
{
  "classification": "<one of the above>",
  "confidence": 0.0-1.0,
  "extracted": {
    "phone": null,
    "asking_price": null,
    "noi": null,
    "cap_rate": null,
    "return_date": null,
    "selected_slot": null,
    "referral_name": null,
    "referral_email": null,
    "broker_name": null,
    "broker_company": null,
    "docs_promised": [],
    "docs_received": [],
    "nurture_timeframe": null,
    "buy_criteria": null,
    "criteria_complete": false,
    "missing_fields": []
  },
  "draft_reply": "Your reply here or null if no reply needed",
  "attach_doc": null,
  "now_qualified": false,
  "reasoning": "Brief explanation of classification"
}

RULES:
- For hot_schedule: Include 3-4 specific slots from my calendar in draft_reply
- For hot_confirm: Extract which slot they picked (selected_slot)
- For doc_promised: List which docs in docs_promised array
- For buyer_inquiry/buyer_criteria_update: Extract criteria into buy_criteria object
- For ooo: Extract return_date if mentioned
- Keep draft replies concise, professional, no signature (Outlook adds it)
- If confidence < 0.7, set classification to unclear`;
}

// =============================================================================
// ACTION EXECUTION
// =============================================================================

async function executeAction(
  result: ClassificationResult,
  email: EmailRecord,
  contact: ContactRecord,
  company: CompanyRecord | null,
  property: PropertyRecord | null,
  qualification: QualificationRecord | null,
  buyerCriteria: BuyerCriteriaRecord | null,
  availableSlots: CalendarSlot[],
  boss: PgBoss
): Promise<void> {
  const { classification, extracted, draft_reply } = result;

  // Always update company to 'engaged' if they replied (except bounce/wrong_contact)
  if (company && !['bounce', 'wrong_contact', 'ooo'].includes(classification)) {
    if (company.status === 'contacted') {
      await supabase
        .from('companies')
        .update({ status: 'engaged', status_changed_at: new Date().toISOString() })
        .eq('id', company.id);
      console.log(`[process-replies] Updated company ${company.id} to 'engaged'`);
    }
  }

  switch (classification) {
    case 'hot_interested':
      await handleHotInterested(result, email, contact, company, property, boss);
      break;

    case 'hot_schedule':
      await handleHotSchedule(result, email, contact, company, property, availableSlots, boss);
      break;

    case 'hot_confirm':
      await handleHotConfirm(result, email, contact, company, property, boss);
      break;

    case 'hot_pricing':
      await handleHotPricing(result, email, contact, company, property, qualification, boss);
      break;

    case 'question':
      await handleQuestion(result, email, contact, boss);
      break;

    case 'info_request':
      await handleInfoRequest(result, email, contact, boss);
      break;

    case 'referral':
      await handleReferral(result, email, contact, company, boss);
      break;

    case 'broker':
      await handleBroker(result, email, contact, company);
      break;

    case 'ooo':
      await handleOOO(result, email, contact);
      break;

    case 'soft_pass':
      await handleSoftPass(result, email, contact, company);
      break;

    case 'hard_pass':
      await handleHardPass(result, email, contact, company);
      break;

    case 'wrong_contact':
      await handleWrongContact(result, email, contact, company, property);
      break;

    case 'bounce':
      await handleBounce(email, contact);
      break;

    case 'doc_promised':
      await handleDocPromised(result, email, contact, company, property, qualification, boss);
      break;

    case 'doc_received':
      await handleDocReceived(result, email, contact, company, property, qualification, boss);
      break;

    case 'buyer_inquiry':
    case 'buyer_criteria_update':
      await handleBuyerInquiry(result, email, contact, company, buyerCriteria, boss);
      break;

    case 'general_update':
      await handleGeneralUpdate(result, email, contact, boss);
      break;

    case 'unclear':
      await handleUnclear(email, contact);
      break;
  }
}

// =============================================================================
// ACTION HANDLERS
// =============================================================================

async function handleHotInterested(
  result: ClassificationResult,
  email: EmailRecord,
  contact: ContactRecord,
  company: CompanyRecord | null,
  property: PropertyRecord | null,
  boss: PgBoss
): Promise<void> {
  if (result.draft_reply && result.confidence >= 0.8) {
    await queueReplyEmail(email, contact, result.draft_reply, boss);
  } else if (result.draft_reply) {
    await createDraft(email, contact, result.draft_reply, 'qualification');
  }

  // Create or update qualification record
  if (property && company) {
    await upsertQualification(company.id, property.id, {
      status: 'engaging',
      last_response_at: new Date().toISOString(),
    });
  }
}

async function handleHotSchedule(
  result: ClassificationResult,
  email: EmailRecord,
  contact: ContactRecord,
  company: CompanyRecord | null,
  property: PropertyRecord | null,
  availableSlots: CalendarSlot[],
  boss: PgBoss
): Promise<void> {
  // Update contact phone if extracted
  if (result.extracted.phone) {
    await supabase
      .from('contacts')
      .update({ phone: result.extracted.phone })
      .eq('id', contact.id);
  }

  // Inject calendar slots into draft if available
  let draftWithSlots = result.draft_reply || '';
  if (availableSlots.length > 0 && draftWithSlots) {
    const slotText = availableSlots.slice(0, 4).map((s) => `- ${s.display}`).join('\n');
    if (!draftWithSlots.includes(slotText)) {
      draftWithSlots = draftWithSlots.replace(
        /\[SLOTS\]|\{SLOTS\}|<SLOTS>/gi,
        slotText
      );
    }
  }

  // Save scheduling state
  await supabase
    .from('synced_emails')
    .update({
      scheduling_state: {
        status: 'awaiting_confirmation',
        offered_slots: availableSlots.slice(0, 4).map((s) => s.datetime),
      },
    })
    .eq('id', email.id);

  if (draftWithSlots && result.confidence >= 0.85) {
    await queueReplyEmail(email, contact, draftWithSlots, boss);
  } else if (draftWithSlots) {
    await createDraft(email, contact, draftWithSlots, 'scheduling');
  }
}

async function handleHotConfirm(
  result: ClassificationResult,
  email: EmailRecord,
  contact: ContactRecord,
  company: CompanyRecord | null,
  property: PropertyRecord | null,
  boss: PgBoss
): Promise<void> {
  const selectedSlot = result.extracted.selected_slot;

  if (!selectedSlot) {
    console.warn('[process-replies] hot_confirm but no selected_slot extracted');
    await createDraft(email, contact, result.draft_reply || '', 'scheduling');
    return;
  }

  try {
    // Parse the selected slot
    const slotDate = new Date(selectedSlot);

    // Create calendar event
    const eventId = await createCalendarMeeting(
      `Call w/ ${contact.name}${property ? ` - ${property.address}` : ''}`,
      slotDate,
      30,
      contact.email,
      `Contact: ${contact.name}\nPhone: ${contact.phone || 'N/A'}\nCompany: ${company?.name || 'N/A'}\nProperty: ${property?.address || 'N/A'}`
    );

    // Create scheduled_calls record
    const { data: callRecord } = await supabase
      .from('scheduled_calls')
      .insert({
        contact_id: contact.id,
        company_id: company?.id,
        property_id: property?.id,
        scheduled_at: slotDate.toISOString(),
        duration_minutes: 30,
        calendar_event_id: eventId,
        phone: contact.phone,
        subject: `Call w/ ${contact.name}`,
        source_email_id: email.id,
        status: 'scheduled',
      })
      .select()
      .single();

    // Update scheduling state
    await supabase
      .from('synced_emails')
      .update({
        scheduling_state: {
          status: 'scheduled',
          selected_slot: selectedSlot,
          calendar_event_id: eventId,
        },
      })
      .eq('id', email.id);

    // Send confirmation
    const confirmDraft =
      result.draft_reply ||
      `Perfect, I've sent you a calendar invite for ${formatSlotDisplay(slotDate)}. Talk soon!`;
    await queueReplyEmail(email, contact, confirmDraft, boss);

    // Create call prep task
    await supabase.from('tasks').insert({
      type: 'call_prep',
      contact_id: contact.id,
      company_id: company?.id,
      property_id: property?.id,
      title: `Call prep: ${contact.name}`,
      description: `Scheduled call at ${formatSlotDisplay(slotDate)}`,
      due_date: slotDate.toISOString().split('T')[0],
      due_time: slotDate.toTimeString().split(' ')[0],
      source_email_id: email.id,
      auto_generated: true,
    });

    console.log(`[process-replies] Scheduled call for ${selectedSlot}, event ${eventId}`);
  } catch (err) {
    console.error('[process-replies] Failed to create calendar event:', err);
    await createDraft(email, contact, result.draft_reply || '', 'scheduling');
  }
}

async function handleHotPricing(
  result: ClassificationResult,
  email: EmailRecord,
  contact: ContactRecord,
  company: CompanyRecord | null,
  property: PropertyRecord | null,
  qualification: QualificationRecord | null,
  boss: PgBoss
): Promise<void> {
  const { asking_price, noi, cap_rate } = result.extracted;

  if (property && company) {
    const updates: Record<string, unknown> = {
      last_response_at: new Date().toISOString(),
    };

    if (asking_price) updates.asking_price = asking_price;
    if (noi) updates.noi = noi;
    if (cap_rate) updates.cap_rate = cap_rate;

    await upsertQualification(company.id, property.id, updates);

    // Check if now qualified
    const { data: qual } = await supabase
      .from('qualification_data')
      .select('*')
      .eq('company_id', company.id)
      .eq('property_id', property.id)
      .single();

    if (qual && isQualified(qual)) {
      await supabase
        .from('qualification_data')
        .update({
          status: 'qualified',
          qualified_at: new Date().toISOString(),
        })
        .eq('id', qual.id);

      await supabase
        .from('companies')
        .update({ status: 'qualified', status_changed_at: new Date().toISOString() })
        .eq('id', company.id);

      console.log(`[process-replies] Deal qualified: ${company.name}`);
    }
  }

  if (result.draft_reply) {
    await queueReplyEmail(email, contact, result.draft_reply, boss);
  }
}

async function handleQuestion(
  result: ClassificationResult,
  email: EmailRecord,
  contact: ContactRecord,
  boss: PgBoss
): Promise<void> {
  if (result.draft_reply && result.confidence >= 0.8) {
    await queueReplyEmail(email, contact, result.draft_reply, boss);
  } else if (result.draft_reply) {
    await createDraft(email, contact, result.draft_reply, 'qualification');
  }
}

async function handleInfoRequest(
  result: ClassificationResult,
  email: EmailRecord,
  contact: ContactRecord,
  boss: PgBoss
): Promise<void> {
  // Note: Attachment handling would need to be implemented in send-email job
  if (result.draft_reply) {
    await queueReplyEmail(email, contact, result.draft_reply, boss, result.attach_doc);
  }
}

async function handleReferral(
  result: ClassificationResult,
  email: EmailRecord,
  contact: ContactRecord,
  company: CompanyRecord | null,
  boss: PgBoss
): Promise<void> {
  const { referral_name, referral_email } = result.extracted;

  if (referral_email) {
    // Create new contact
    const { data: newContact, error } = await supabase
      .from('contacts')
      .insert({
        company_id: company?.id,
        name: referral_name || 'Unknown',
        email: referral_email.toLowerCase(),
        source: 'referral',
      })
      .select()
      .single();

    if (!error && newContact) {
      console.log(`[process-replies] Created referral contact: ${referral_email}`);

      // TODO: Optionally enroll in sequence
    }
  }

  // Thank the referrer
  if (result.draft_reply) {
    await queueReplyEmail(email, contact, result.draft_reply, boss);
  }
}

async function handleBroker(
  result: ClassificationResult,
  email: EmailRecord,
  contact: ContactRecord,
  company: CompanyRecord | null
): Promise<void> {
  const { broker_name, broker_company } = result.extracted;

  if (company) {
    await supabase
      .from('companies')
      .update({
        has_broker: true,
        broker_contact: broker_name
          ? `${broker_name}${broker_company ? ` (${broker_company})` : ''}`
          : broker_company,
        status: 'rejected', // Or create a task for decision
        status_changed_at: new Date().toISOString(),
      })
      .eq('id', company.id);
  }

  // Create task for broker decision
  await supabase.from('tasks').insert({
    type: 'broker_decision',
    contact_id: contact.id,
    company_id: company?.id,
    title: `Broker redirect: ${contact.name}`,
    description: `Contact redirected to broker: ${broker_name || broker_company || 'Unknown'}. Decide whether to pursue through broker.`,
    due_date: new Date().toISOString().split('T')[0],
    source_email_id: email.id,
    auto_generated: true,
  });
}

async function handleOOO(
  result: ClassificationResult,
  email: EmailRecord,
  contact: ContactRecord
): Promise<void> {
  const returnDate = result.extracted.return_date
    ? new Date(result.extracted.return_date)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days

  await supabase.from('tasks').insert({
    type: 'ooo_follow_up',
    contact_id: contact.id,
    title: `Follow up after OOO: ${contact.name}`,
    description: `Contact was out of office. Return date: ${returnDate.toDateString()}`,
    due_date: returnDate.toISOString().split('T')[0],
    source_email_id: email.id,
    auto_generated: true,
  });
}

async function handleSoftPass(
  result: ClassificationResult,
  email: EmailRecord,
  contact: ContactRecord,
  company: CompanyRecord | null
): Promise<void> {
  // Parse nurture timeframe (default 6 months)
  let nurtureDays = 180;
  if (result.extracted.nurture_timeframe) {
    const tf = result.extracted.nurture_timeframe.toLowerCase();
    if (tf.includes('year')) nurtureDays = 365;
    else if (tf.includes('month')) {
      const months = parseInt(tf.match(/(\d+)/)?.[1] || '6');
      nurtureDays = months * 30;
    }
  }

  const followUpDate = new Date(Date.now() + nurtureDays * 24 * 60 * 60 * 1000);

  if (company) {
    await supabase
      .from('companies')
      .update({ status: 'rejected', status_changed_at: new Date().toISOString() })
      .eq('id', company.id);
  }

  await supabase.from('tasks').insert({
    type: 'nurture',
    contact_id: contact.id,
    company_id: company?.id,
    title: `Nurture: ${contact.name}`,
    description: `Soft pass - revisit in ${nurtureDays} days`,
    due_date: followUpDate.toISOString().split('T')[0],
    source_email_id: email.id,
    auto_generated: true,
  });
}

async function handleHardPass(
  result: ClassificationResult,
  email: EmailRecord,
  contact: ContactRecord,
  company: CompanyRecord | null
): Promise<void> {
  // Add to DNC
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

  // Update contact status
  await supabase
    .from('contacts')
    .update({ status: 'dnc', status_changed_at: new Date().toISOString() })
    .eq('id', contact.id);

  // Update company status
  if (company) {
    await supabase
      .from('companies')
      .update({ status: 'dnc', status_changed_at: new Date().toISOString() })
      .eq('id', company.id);
  }

  console.log(`[process-replies] Added ${email.from_email} to DNC`);
}

async function handleWrongContact(
  result: ClassificationResult,
  email: EmailRecord,
  contact: ContactRecord,
  company: CompanyRecord | null,
  property: PropertyRecord | null
): Promise<void> {
  // Flag property_companies as stale
  if (property && company) {
    await supabase
      .from('property_companies')
      .update({ needs_review: true, review_reason: 'Contact reports no ownership' } as Record<string, unknown>)
      .eq('property_id', property.id)
      .eq('company_id', company.id);
  }

  // Create research task
  await supabase.from('tasks').insert({
    type: 'research_owner',
    contact_id: contact.id,
    company_id: company?.id,
    property_id: property?.id,
    title: `Research owner: ${property?.address || 'Unknown property'}`,
    description: `Contact ${contact.name} reports they no longer own this property.`,
    due_date: new Date().toISOString().split('T')[0],
    source_email_id: email.id,
    auto_generated: true,
  });
}

async function handleBounce(email: EmailRecord, contact: ContactRecord): Promise<void> {
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
  await supabase
    .from('contacts')
    .update({ status: 'bounced', status_changed_at: new Date().toISOString() })
    .eq('id', contact.id);

  console.log(`[process-replies] Marked ${email.from_email} as bounced`);
}

async function handleDocPromised(
  result: ClassificationResult,
  email: EmailRecord,
  contact: ContactRecord,
  company: CompanyRecord | null,
  property: PropertyRecord | null,
  qualification: QualificationRecord | null,
  boss: PgBoss
): Promise<void> {
  const { asking_price, noi, cap_rate, docs_promised } = result.extracted;

  if (property && company) {
    const updates: Record<string, unknown> = {
      last_response_at: new Date().toISOString(),
      follow_up_count: 0, // Reset since they responded
    };

    if (asking_price) updates.asking_price = asking_price;
    if (noi) updates.noi = noi;
    if (cap_rate) updates.cap_rate = cap_rate;

    if (docs_promised?.includes('rent_roll')) {
      updates.rent_roll_status = 'promised';
    }
    if (
      docs_promised?.includes('operating_statement') ||
      docs_promised?.includes('t12') ||
      docs_promised?.includes('financials')
    ) {
      updates.operating_statement_status = 'promised';
    }

    await upsertQualification(company.id, property.id, updates);
  }

  // Schedule follow-up task
  const followUpDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
  await supabase.from('tasks').insert({
    type: 'doc_follow_up',
    contact_id: contact.id,
    company_id: company?.id,
    property_id: property?.id,
    title: `Doc follow-up: ${contact.name}`,
    description: `Promised: ${docs_promised?.join(', ') || 'documents'}`,
    due_date: followUpDate.toISOString().split('T')[0],
    source_email_id: email.id,
    auto_generated: true,
  });

  if (result.draft_reply) {
    await queueReplyEmail(email, contact, result.draft_reply, boss);
  }
}

async function handleDocReceived(
  result: ClassificationResult,
  email: EmailRecord,
  contact: ContactRecord,
  company: CompanyRecord | null,
  property: PropertyRecord | null,
  qualification: QualificationRecord | null,
  boss: PgBoss
): Promise<void> {
  const { docs_received } = result.extracted;

  if (property && company) {
    const updates: Record<string, unknown> = {
      last_response_at: new Date().toISOString(),
    };

    if (docs_received?.includes('rent_roll')) {
      updates.rent_roll_status = 'received';
    }
    if (
      docs_received?.includes('operating_statement') ||
      docs_received?.includes('t12') ||
      docs_received?.includes('financials')
    ) {
      updates.operating_statement_status = 'received';
    }

    await upsertQualification(company.id, property.id, updates);

    // Check if now qualified
    const { data: qual } = await supabase
      .from('qualification_data')
      .select('*')
      .eq('company_id', company.id)
      .eq('property_id', property.id)
      .single();

    if (qual && isQualified(qual)) {
      await supabase
        .from('qualification_data')
        .update({
          status: 'qualified',
          qualified_at: new Date().toISOString(),
        })
        .eq('id', qual.id);

      await supabase
        .from('companies')
        .update({ status: 'qualified', status_changed_at: new Date().toISOString() })
        .eq('id', company.id);

      // Create deal review task
      await supabase.from('tasks').insert({
        type: 'review_deal',
        contact_id: contact.id,
        company_id: company.id,
        property_id: property.id,
        title: `Deal qualified: ${company.name}`,
        description: 'All qualification criteria met. Review for handoff.',
        due_date: new Date().toISOString().split('T')[0],
        source_email_id: email.id,
        auto_generated: true,
      });

      console.log(`[process-replies] Deal qualified: ${company.name}`);
    }
  }

  if (result.draft_reply) {
    await queueReplyEmail(email, contact, result.draft_reply, boss);
  }
}

async function handleBuyerInquiry(
  result: ClassificationResult,
  email: EmailRecord,
  contact: ContactRecord,
  company: CompanyRecord | null,
  existingCriteria: BuyerCriteriaRecord | null,
  boss: PgBoss
): Promise<void> {
  const { buy_criteria, criteria_complete, missing_fields } = result.extracted;

  if (existingCriteria) {
    // Merge with existing criteria
    const merged = {
      ...existingCriteria,
      property_types: buy_criteria?.property_types || existingCriteria.property_types,
      markets: buy_criteria?.markets || existingCriteria.markets,
      submarkets: buy_criteria?.submarkets || existingCriteria.submarkets,
      size_min: buy_criteria?.size_min || existingCriteria.size_min,
      size_max: buy_criteria?.size_max || existingCriteria.size_max,
      price_min: buy_criteria?.price_min || existingCriteria.price_min,
      price_max: buy_criteria?.price_max || existingCriteria.price_max,
      deal_type: buy_criteria?.deal_type || existingCriteria.deal_type,
      timeline: buy_criteria?.timeline || existingCriteria.timeline,
      exchange_1031: buy_criteria?.exchange_1031 ?? existingCriteria.exchange_1031,
      other_notes: buy_criteria?.notes || existingCriteria.other_notes,
      missing_fields: missing_fields || [],
      status: criteria_complete ? 'complete' : 'gathering',
      completed_at: criteria_complete ? new Date().toISOString() : null,
    };

    await supabase
      .from('buyer_criteria_tracking')
      .update(merged)
      .eq('id', existingCriteria.id);
  } else {
    // Create new buyer criteria record
    await supabase.from('buyer_criteria_tracking').insert({
      contact_id: contact.id,
      company_id: company?.id,
      property_types: buy_criteria?.property_types,
      markets: buy_criteria?.markets,
      submarkets: buy_criteria?.submarkets,
      size_min: buy_criteria?.size_min,
      size_max: buy_criteria?.size_max,
      price_min: buy_criteria?.price_min,
      price_max: buy_criteria?.price_max,
      deal_type: buy_criteria?.deal_type,
      timeline: buy_criteria?.timeline,
      exchange_1031: buy_criteria?.exchange_1031,
      other_notes: buy_criteria?.notes,
      missing_fields: missing_fields,
      status: criteria_complete ? 'complete' : 'gathering',
      completed_at: criteria_complete ? new Date().toISOString() : null,
    });
  }

  // If criteria complete, create search and queue sourcing agent
  if (criteria_complete && buy_criteria) {
    const { data: search } = await supabase
      .from('searches')
      .insert({
        name: `${contact.name} - Buy Criteria`,
        source: 'inbound_inquiry',
        criteria_json: buy_criteria,
        status: 'pending_queries',
      })
      .select()
      .single();

    if (search) {
      // Link to buyer criteria tracking
      await supabase
        .from('buyer_criteria_tracking')
        .update({ search_id: search.id })
        .eq('contact_id', contact.id);

      // Queue sourcing agent
      await boss.send('generate-queries', { searchId: search.id });
      console.log(`[process-replies] Created search ${search.id} for buyer ${contact.name}`);
    }
  }

  if (result.draft_reply) {
    await queueReplyEmail(email, contact, result.draft_reply, boss);
  }
}

async function handleGeneralUpdate(
  result: ClassificationResult,
  email: EmailRecord,
  contact: ContactRecord,
  boss: PgBoss
): Promise<void> {
  // Update last contact
  await supabase
    .from('contacts')
    .update({ last_contacted_at: new Date().toISOString() })
    .eq('id', contact.id);

  if (result.draft_reply && result.confidence >= 0.8) {
    await queueReplyEmail(email, contact, result.draft_reply, boss);
  }
}

async function handleUnclear(email: EmailRecord, contact: ContactRecord): Promise<void> {
  await supabase.from('tasks').insert({
    type: 'human_review',
    contact_id: contact.id,
    title: `Review email: ${contact.name}`,
    description: `Could not automatically classify email. Manual review needed.`,
    due_date: new Date().toISOString().split('T')[0],
    source_email_id: email.id,
    auto_generated: true,
  });
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function queueReplyEmail(
  originalEmail: EmailRecord,
  contact: ContactRecord,
  body: string,
  boss: PgBoss,
  attachment?: string
): Promise<void> {
  const subject = originalEmail.subject?.startsWith('Re:')
    ? originalEmail.subject
    : `Re: ${originalEmail.subject || 'Your inquiry'}`;

  await boss.send('send-email', {
    queueId: crypto.randomUUID(),
    toEmail: contact.email,
    toName: contact.name,
    subject,
    bodyText: body,
    priority: 1,
    jobType: 'manual_reply',
    attachment,
  });

  console.log(`[process-replies] Queued reply to ${contact.email}`);
}

async function createDraft(
  email: EmailRecord,
  contact: ContactRecord,
  body: string,
  draftType: string
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
    in_reply_to_email_id: email.id,
    draft_type: draftType,
    status: 'pending',
    generated_by: 'process-replies',
  });

  console.log(`[process-replies] Created draft for review: ${contact.email}`);
}

async function upsertQualification(
  companyId: string,
  propertyId: string,
  updates: Record<string, unknown>
): Promise<void> {
  const { data: existing } = await supabase
    .from('qualification_data')
    .select('id')
    .eq('company_id', companyId)
    .eq('property_id', propertyId)
    .single();

  if (existing) {
    await supabase
      .from('qualification_data')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase.from('qualification_data').insert({
      company_id: companyId,
      property_id: propertyId,
      ...updates,
    });
  }
}

function isQualified(qual: Record<string, unknown>): boolean {
  const pricingCount = [qual.asking_price, qual.noi, qual.cap_rate].filter(
    (v) => v != null
  ).length;

  return (
    pricingCount >= 2 &&
    qual.rent_roll_status === 'received' &&
    qual.operating_statement_status === 'received'
  );
}

function formatSlotDisplay(date: Date): string {
  return date.toLocaleString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

/**
 * Extract the original recipient email from a bounce message
 */
function extractBounceRecipient(subject: string, body: string): string | null {
  // Common patterns in bounce messages
  const patterns = [
    // "Undeliverable: [subject]" - look in body for recipient
    /(?:to|recipient|address)[:\s]+<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i,
    // "Mail delivery failed: returning message to sender" - extract from body
    /(?:could not be delivered to)[:\s]+<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i,
    // Generic email in subject
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
  ];

  // Check body first (more reliable)
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // Check subject
  for (const pattern of patterns) {
    const match = subject.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Infer contact_type from classification
 */
function inferContactType(classification: string): 'buyer' | 'seller' | 'other' {
  // Buyer inquiries indicate they want to buy, not sell
  if (classification === 'buyer_inquiry' || classification === 'buyer_criteria_update') {
    return 'buyer';
  }
  // Most inbound contacts in CRE sourcing are property owners (sellers)
  // These classifications indicate they're responding to outreach about selling
  if (
    [
      'hot_interested',
      'hot_schedule',
      'hot_confirm',
      'hot_pricing',
      'question',
      'info_request',
      'referral',
      'doc_promised',
      'doc_received',
    ].includes(classification)
  ) {
    return 'seller';
  }
  return 'other';
}

/**
 * Create a new contact and optionally company for an unknown sender
 */
async function createContactForSender(
  email: EmailRecord,
  classification: string
): Promise<{ contact: ContactRecord; company: CompanyRecord | null }> {
  const emailLower = email.from_email.toLowerCase();
  const domain = emailLower.split('@')[1] || 'unknown';
  const senderName = email.from_name || emailLower.split('@')[0];

  // Infer contact type from classification
  const contactType = inferContactType(classification);
  const isBuyer = contactType === 'buyer';

  // First, check if a company exists for this domain
  let company: CompanyRecord | null = null;

  // Try to find existing company by domain (heuristic)
  const { data: existingCompany } = await supabase
    .from('companies')
    .select('id, name, status')
    .ilike('name', `%${domain.split('.')[0]}%`)
    .limit(1)
    .single();

  if (existingCompany) {
    company = existingCompany as CompanyRecord;
  } else {
    // Create new company
    const { data: newCompany } = await supabase
      .from('companies')
      .insert({
        name: domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
        status: 'new',
        source: 'inbound_email',
      })
      .select()
      .single();

    company = newCompany as CompanyRecord;
  }

  // Create the contact with inferred contact_type
  const { data: newContact } = await supabase
    .from('contacts')
    .insert({
      company_id: company?.id,
      name: senderName,
      email: emailLower,
      source: 'inbound_email',
      status: 'active',
      contact_type: contactType,
      is_buyer: isBuyer,
    })
    .select()
    .single();

  if (!newContact) {
    throw new Error(`Failed to create contact for ${emailLower}`);
  }

  console.log(
    `[process-replies] Created new contact ${newContact.id} for ${emailLower} (type: ${contactType})`
  );

  return {
    contact: newContact as ContactRecord,
    company,
  };
}

