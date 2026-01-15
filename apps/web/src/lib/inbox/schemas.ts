import { z } from "zod";

// =============================================================================
// Classification Configuration - Single Source of Truth
// =============================================================================

export const CLASSIFICATIONS = {
  interested: {
    label: "Interested",
    shortLabel: "Interested",
    color: "green",
    group: "hot",
    actions: ["create_deal", "schedule_call", "reply"],
  },
  wants_offer: {
    label: "Wants Offer",
    shortLabel: "Offer",
    color: "green",
    group: "hot",
    actions: ["create_deal", "schedule_call", "reply"],
  },
  wants_to_buy: {
    label: "Wants to Buy",
    shortLabel: "Buyer",
    color: "blue",
    group: "hot",
    actions: ["create_search", "schedule_call", "reply"],
  },
  schedule_call: {
    label: "Schedule Call",
    shortLabel: "Call",
    color: "purple",
    group: "action",
    actions: ["schedule_call", "reply"],
  },
  question: {
    label: "Question",
    shortLabel: "?",
    color: "yellow",
    group: "action",
    actions: ["reply"],
  },
  not_interested: {
    label: "Not Interested",
    shortLabel: "Pass",
    color: "gray",
    group: "closed",
    actions: ["archive"],
  },
  wrong_contact: {
    label: "Wrong Contact",
    shortLabel: "Wrong",
    color: "orange",
    group: "closed",
    actions: ["archive"],
  },
  broker_redirect: {
    label: "Broker",
    shortLabel: "Broker",
    color: "orange",
    group: "closed",
    actions: ["archive"],
  },
  dnc: {
    label: "DNC",
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
  unclassified: {
    label: "Unclassified",
    shortLabel: "New",
    color: "gray",
    group: "action",
    actions: ["reply", "mark_reviewed"],
  },
} as const;

export type Classification = keyof typeof CLASSIFICATIONS;
export type ClassificationGroup = "hot" | "action" | "closed";

export const classificationSchema = z.enum([
  "interested",
  "wants_offer",
  "wants_to_buy",
  "schedule_call",
  "question",
  "not_interested",
  "wrong_contact",
  "broker_redirect",
  "dnc",
  "bounce",
  "unclassified",
]);

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

export const inboxMessageSchema = z.object({
  id: z.string().uuid(),
  outlook_id: z.string().nullable(),
  thread_id: z.string().nullable(),
  from_email: z.string().email(),
  from_name: z.string().nullable(),
  to_email: z.string().nullable(),
  subject: z.string().nullable(),
  body_text: z.string().nullable(),
  body_html: z.string().nullable(),
  received_at: z.string().datetime(),
  enrollment_id: z.string().uuid().nullable(),
  contact_id: z.string().uuid().nullable(),
  property_id: z.string().uuid().nullable(),
  classification: classificationSchema.nullable(),
  classification_confidence: z.number().min(0).max(1).nullable(),
  classification_reasoning: z.string().nullable(),
  status: statusSchema,
  action_taken: z.string().nullable(),
  created_at: z.string().datetime(),
  contact: contactSchema.nullable().optional(),
  property: propertySchema.nullable().optional(),
  enrollment: enrollmentSchema.nullable().optional(),
});

export type InboxMessage = z.infer<typeof inboxMessageSchema>;

// =============================================================================
// API Request/Response Schemas
// =============================================================================

export const inboxFiltersSchema = z.object({
  status: statusSchema.or(z.literal("all")).default("all"),
  classification: classificationSchema.or(z.literal("all")).default("all"),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export type InboxFilters = z.infer<typeof inboxFiltersSchema>;

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

export function getClassificationConfig(classification: Classification | null) {
  if (!classification) return CLASSIFICATIONS.unclassified;
  return CLASSIFICATIONS[classification];
}

export function getAvailableActions(
  classification: Classification | null,
  hasProperty: boolean,
  hasContact: boolean
): Action[] {
  const config = getClassificationConfig(classification);
  return config.actions.filter((action) => {
    const actionConfig = ACTIONS[action];
    if (actionConfig.requiresProperty && !hasProperty) return false;
    if (actionConfig.requiresContact && !hasContact) return false;
    return true;
  });
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
