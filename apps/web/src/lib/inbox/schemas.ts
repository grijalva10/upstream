import { z } from "zod";

// =============================================================================
// Classification Configuration - Single Source of Truth
// =============================================================================

export const CLASSIFICATIONS = {
  // HOT (seller interested)
  hot_interested: {
    label: "Interested",
    shortLabel: "Hot",
    color: "green",
    group: "hot",
    actions: ["create_deal", "schedule_call", "reply"],
  },
  hot_pricing: {
    label: "Pricing Given",
    shortLabel: "Pricing",
    color: "green",
    group: "hot",
    actions: ["create_deal", "schedule_call", "reply"],
  },
  hot_schedule: {
    label: "Wants Call",
    shortLabel: "Call",
    color: "green",
    group: "hot",
    actions: ["schedule_call", "reply"],
  },
  hot_confirm: {
    label: "Confirmed",
    shortLabel: "Confirm",
    color: "green",
    group: "hot",
    actions: ["schedule_call", "reply"],
  },
  // QUALIFICATION
  question: {
    label: "Question",
    shortLabel: "?",
    color: "yellow",
    group: "action",
    actions: ["reply"],
  },
  info_request: {
    label: "Info Request",
    shortLabel: "Info",
    color: "yellow",
    group: "action",
    actions: ["reply"],
  },
  doc_promised: {
    label: "Doc Promised",
    shortLabel: "Promised",
    color: "yellow",
    group: "action",
    actions: ["reply", "mark_reviewed"],
  },
  doc_received: {
    label: "Doc Received",
    shortLabel: "Docs",
    color: "green",
    group: "action",
    actions: ["create_deal", "reply"],
  },
  // BUYER
  buyer_inquiry: {
    label: "Buyer Inquiry",
    shortLabel: "Buyer",
    color: "blue",
    group: "action",
    actions: ["create_search", "reply"],
  },
  buyer_criteria_update: {
    label: "Criteria Update",
    shortLabel: "Criteria",
    color: "blue",
    group: "action",
    actions: ["reply", "mark_reviewed"],
  },
  // REDIRECT
  referral: {
    label: "Referral",
    shortLabel: "Referral",
    color: "orange",
    group: "redirect",
    actions: ["reply", "archive"],
  },
  broker: {
    label: "Broker",
    shortLabel: "Broker",
    color: "orange",
    group: "redirect",
    actions: ["archive"],
  },
  wrong_contact: {
    label: "Wrong Contact",
    shortLabel: "Wrong",
    color: "orange",
    group: "redirect",
    actions: ["archive"],
  },
  ooo: {
    label: "Out of Office",
    shortLabel: "OOO",
    color: "gray",
    group: "redirect",
    actions: ["mark_reviewed"],
  },
  // CLOSED
  soft_pass: {
    label: "Soft Pass",
    shortLabel: "Pass",
    color: "gray",
    group: "closed",
    actions: ["archive"],
  },
  hard_pass: {
    label: "Hard Pass",
    shortLabel: "DNC",
    color: "red",
    group: "closed",
    actions: ["confirm_dnc"],
  },
  bounce: {
    label: "Bounce",
    shortLabel: "Bounce",
    color: "red",
    group: "closed",
    actions: ["confirm_bounce"],
  },
  // OTHER
  general_update: {
    label: "General",
    shortLabel: "General",
    color: "gray",
    group: "action",
    actions: ["reply", "mark_reviewed"],
  },
  unclear: {
    label: "Unclear",
    shortLabel: "?",
    color: "gray",
    group: "action",
    actions: ["reply", "mark_reviewed"],
  },
  // AUTO-FILTERED (set by pre-classification filter, not Claude)
  newsletter: {
    label: "Newsletter",
    shortLabel: "News",
    color: "gray",
    group: "filtered",
    actions: ["archive"],
  },
  internal: {
    label: "Internal",
    shortLabel: "Team",
    color: "gray",
    group: "filtered",
    actions: ["archive"],
  },
} as const;

export type Classification = keyof typeof CLASSIFICATIONS;

export const classificationSchema = z.enum([
  "hot_interested",
  "hot_pricing",
  "hot_schedule",
  "hot_confirm",
  "question",
  "info_request",
  "doc_promised",
  "doc_received",
  "buyer_inquiry",
  "buyer_criteria_update",
  "referral",
  "broker",
  "wrong_contact",
  "ooo",
  "soft_pass",
  "hard_pass",
  "bounce",
  "general_update",
  "unclear",
  // Auto-filtered (set before Claude classification)
  "newsletter",
  "internal",
]);

// =============================================================================
// View Mode Configuration
// =============================================================================

export const VIEW_MODES = {
  needs_review: { label: "Needs Review", description: "Low confidence or unknown contact" },
  auto_handled: { label: "Auto-handled", description: "AI acted autonomously" },
  all: { label: "All", description: "All inbound emails" },
} as const;

export type ViewMode = keyof typeof VIEW_MODES;

export const viewModeSchema = z.enum(["needs_review", "auto_handled", "all"]);

// =============================================================================
// Status Configuration
// =============================================================================

export const STATUSES = {
  new: { label: "New", color: "blue" },
  reviewed: { label: "Reviewed", color: "yellow" },
  actioned: { label: "Actioned", color: "green" },
} as const;

export type Status = keyof typeof STATUSES;

export const statusSchema = z.enum(["new", "reviewed", "actioned"]);

// =============================================================================
// Action Configuration
// =============================================================================

export const ACTIONS = {
  create_deal: {
    label: "Create Deal",
    requiresProperty: true,
    requiresContact: false,
  },
  schedule_call: {
    label: "Schedule Call",
    requiresProperty: false,
    requiresContact: true,
  },
  create_search: {
    label: "Create Search",
    requiresProperty: false,
    requiresContact: false,
  },
  confirm_dnc: {
    label: "Confirm DNC",
    requiresProperty: false,
    requiresContact: false,
  },
  confirm_bounce: {
    label: "Confirm Bounce",
    requiresProperty: false,
    requiresContact: false,
  },
  archive: {
    label: "Archive",
    requiresProperty: false,
    requiresContact: false,
  },
  reply: {
    label: "Reply",
    requiresProperty: false,
    requiresContact: false,
  },
  mark_reviewed: {
    label: "Mark Reviewed",
    requiresProperty: false,
    requiresContact: false,
  },
  approve_draft: {
    label: "Approve Draft",
    requiresProperty: false,
    requiresContact: false,
  },
  edit_draft: {
    label: "Edit Draft",
    requiresProperty: false,
    requiresContact: false,
  },
  create_contact: {
    label: "Create Contact",
    requiresProperty: false,
    requiresContact: false,
  },
} as const;

export type Action = keyof typeof ACTIONS;

export const actionSchema = z.enum([
  "create_deal",
  "schedule_call",
  "create_search",
  "confirm_dnc",
  "confirm_bounce",
  "archive",
  "reply",
  "mark_reviewed",
  "approve_draft",
  "edit_draft",
  "create_contact",
]);

// =============================================================================
// Inbox Message Schema
// =============================================================================

export const contactSchema = z.object({
  name: z.string(),
  email: z.string().email().nullable(),
});

export const propertySchema = z.object({
  address: z.string().nullable(),
  property_name: z.string().nullable(),
});

export const enrollmentSchema = z.object({
  campaign_id: z.string().uuid(),
});

// Helper for nullable UUID - accepts any string or null
const nullableUuid = z.string().nullable().optional();

export const inboxMessageSchema = z.object({
  // Core email fields
  id: z.string().uuid(),
  outlook_entry_id: z.string().nullable().optional(),
  outlook_conversation_id: z.string().nullable().optional(),
  thread_id: z.string().nullable().optional(),
  in_reply_to_id: nullableUuid,
  from_email: z.string(),
  from_name: z.string().nullable().optional(),
  to_emails: z.array(z.string()).nullable().optional(),
  subject: z.string().nullable().optional(),
  body_text: z.string().nullable().optional(),
  body_html: z.string().nullable().optional(),
  received_at: z.string().nullable().optional(),
  sent_at: z.string().nullable().optional(),
  direction: z.string().nullable().optional(),
  is_read: z.boolean().nullable().optional(),
  has_attachments: z.boolean().nullable().optional(),

  // Classification
  classification: z.string().nullable().optional(),
  classification_confidence: z.number().min(0).max(1).nullable().optional(),
  classification_reasoning: z.string().nullable().optional(),
  classified_at: z.string().nullable().optional(),
  classified_by: z.string().nullable().optional(),

  // Review state
  status: z.string().nullable().default("new"),
  needs_review: z.boolean().nullable().optional(),
  auto_handled: z.boolean().nullable().optional(),
  action_taken: z.string().nullable().optional(),
  action_taken_at: z.string().nullable().optional(),

  // Extracted data
  extracted_pricing: z.any().nullable().optional(),
  scheduling_state: z.any().nullable().optional(),

  // Linked entity IDs
  enrollment_id: nullableUuid,
  matched_contact_id: nullableUuid,
  matched_company_id: nullableUuid,
  matched_property_id: nullableUuid,

  // Joined contact info (from inbox_view)
  contact_name: z.string().nullable().optional(),
  contact_type: z.string().nullable().optional(),
  contact_title: z.string().nullable().optional(),
  contact_phone: z.string().nullable().optional(),

  // Joined company info (from inbox_view)
  company_name: z.string().nullable().optional(),
  company_status: z.string().nullable().optional(),

  // Joined property info (from inbox_view)
  property_address: z.string().nullable().optional(),
  property_name: z.string().nullable().optional(),
  property_type: z.string().nullable().optional(),

  // Joined deal info (from inbox_view)
  deal_id: nullableUuid,
  deal_display_id: z.string().nullable().optional(),
  deal_status: z.string().nullable().optional(),

  // Joined draft info (from inbox_view)
  draft_id: nullableUuid,
  draft_subject: z.string().nullable().optional(),
  draft_body: z.string().nullable().optional(),
  draft_status: z.string().nullable().optional(),

  // Enrollment info (from inbox_view)
  campaign_id: nullableUuid,
  enrollment_step: z.number().nullable().optional(),

  // Deprecated: keep for backwards compatibility during migration
  created_at: z.string().nullable().optional(),
  contact: contactSchema.nullable().optional(),
  property: propertySchema.nullable().optional(),
  enrollment: enrollmentSchema.nullable().optional(),
});

export type InboxMessage = z.infer<typeof inboxMessageSchema>;

// =============================================================================
// API Request/Response Schemas
// =============================================================================

// Classification groups for filtering
export const CLASSIFICATION_GROUPS = {
  hot: ["hot_interested", "hot_pricing", "hot_schedule", "hot_confirm"] as Classification[],
  qualify: ["question", "info_request", "doc_promised", "doc_received"] as Classification[],
  buyer: ["buyer_inquiry", "buyer_criteria_update"] as Classification[],
  redirect: ["referral", "broker", "wrong_contact", "ooo"] as Classification[],
  closed: ["soft_pass", "hard_pass", "bounce", "general_update", "unclear"] as Classification[],
  filtered: ["newsletter", "internal"] as Classification[],
} as const;

export type ClassificationGroup = keyof typeof CLASSIFICATION_GROUPS;

export const classificationGroupSchema = z.enum(["hot", "qualify", "buyer", "redirect", "closed", "filtered"]);

export const inboxFiltersSchema = z.object({
  viewMode: viewModeSchema.default("needs_review"),
  status: statusSchema.or(z.literal("all")).default("all"),
  classification: classificationSchema.or(classificationGroupSchema).or(z.literal("all")).default("all"),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

// Helper to expand group to classifications
export function expandClassificationFilter(filter: string): Classification[] | null {
  if (filter === "all") return null;
  if (filter in CLASSIFICATION_GROUPS) {
    return CLASSIFICATION_GROUPS[filter as ClassificationGroup];
  }
  // Single classification
  return [filter as Classification];
}

export type InboxFilters = z.infer<typeof inboxFiltersSchema>;

// =============================================================================
// Inbox Counts Type
// =============================================================================

export interface InboxCounts {
  byViewMode: Record<ViewMode, number>;
  byStatus: Record<Status | "all", number>;
  byClassification: Record<Classification | "all", number>;
}

export const reclassifyRequestSchema = z.object({
  classification: classificationSchema,
});

export const actionRequestSchema = z.object({
  action: actionSchema,
});

export const replyRequestSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
});

// =============================================================================
// Helper Functions
// =============================================================================

export function getClassificationConfig(classification: Classification | string | null) {
  if (!classification) return CLASSIFICATIONS.unclear;
  if (classification in CLASSIFICATIONS) {
    return CLASSIFICATIONS[classification as Classification];
  }
  return CLASSIFICATIONS.unclear;
}

export function getAvailableActions(
  classification: Classification | null,
  hasProperty: boolean,
  hasContact: boolean,
  hasDraft: boolean = false
): Action[] {
  const config = getClassificationConfig(classification);
  const actions: Action[] = [];

  // Add draft actions first if draft exists
  if (hasDraft) {
    actions.push("approve_draft", "edit_draft");
  }

  // Add classification-based actions
  for (const action of config.actions) {
    const actionConfig = ACTIONS[action];
    if (actionConfig.requiresProperty && !hasProperty) continue;
    if (actionConfig.requiresContact && !hasContact) continue;
    actions.push(action);
  }

  // Add create_contact if no contact linked
  if (!hasContact && !actions.includes("create_contact")) {
    actions.push("create_contact");
  }

  return actions;
}

export function getClassificationsByGroup(group: ClassificationGroup): Classification[] {
  return (Object.entries(CLASSIFICATIONS) as [Classification, typeof CLASSIFICATIONS[Classification]][])
    .filter(([, config]) => config.group === group)
    .map(([key]) => key);
}

export function parseInboxMessages(data: unknown): InboxMessage[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => {
      const result = inboxMessageSchema.safeParse(item);
      if (!result.success) {
        console.warn("Invalid inbox message:", result.error.flatten());
        return null;
      }
      return result.data;
    })
    .filter((item): item is InboxMessage => item !== null);
}

