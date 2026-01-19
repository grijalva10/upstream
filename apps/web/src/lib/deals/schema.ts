import { z } from "zod";

// Status enum
export const DealStatus = z.enum([
  "qualifying",
  "qualified",
  "packaged",
  "handed_off",
  "closed",
  "lost",
]);
export type DealStatus = z.infer<typeof DealStatus>;

// Activity types
export const DealActivityType = z.enum([
  "email_sent",
  "email_received",
  "call_scheduled",
  "call_completed",
  "doc_received",
  "status_change",
  "note_added",
  "handed_off",
]);
export type DealActivityType = z.infer<typeof DealActivityType>;

// Related entities
const PropertySchema = z.object({
  id: z.string().uuid(),
  address: z.string(),
  property_type: z.string().nullable(),
  building_size_sqft: z.number().nullable(),
  building_class: z.string().nullable(),
  year_built: z.number().nullable(),
});

const LeadSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

const ContactSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
});

const SearchSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

// Document entry
const DocEntry = z.object({
  name: z.string(),
  url: z.string().url(),
});

// Main deal schema
export const DealSchema = z.object({
  id: z.string().uuid(),
  display_id: z.string(),
  status: DealStatus,
  property_id: z.string().uuid(),
  lead_id: z.string().uuid().nullable(),
  contact_id: z.string().uuid().nullable(),
  search_id: z.string().uuid().nullable(),
  enrollment_id: z.string().uuid().nullable(),

  // Qualification
  asking_price: z.number().nullable(),
  noi: z.number().nullable(),
  cap_rate: z.number().nullable(),
  motivation: z.string().nullable(),
  timeline: z.string().nullable(),
  decision_maker_confirmed: z.boolean(),
  price_realistic: z.boolean().nullable(),

  // Documents
  rent_roll_url: z.string().nullable(),
  operating_statement_url: z.string().nullable(),
  other_docs: z.array(DocEntry).nullable(),

  // Loan
  loan_amount: z.number().nullable(),
  loan_maturity: z.string().nullable(),
  loan_rate: z.number().nullable(),
  lender_name: z.string().nullable(),

  // Package
  investment_summary: z.string().nullable(),
  investment_highlights: z.array(z.string()).nullable(),
  admin_notes: z.string().nullable(),

  // Handoff
  handed_off_to: z.string().nullable(),
  handed_off_at: z.string().nullable(),

  created_at: z.string(),
  updated_at: z.string(),

  // Relations
  properties: PropertySchema.nullable(),
  leads: LeadSchema.nullable(),
  contacts: ContactSchema.nullable(),
  searches: SearchSchema.nullable(),
});

export type Deal = z.infer<typeof DealSchema>;

// Activity schema
export const DealActivitySchema = z.object({
  id: z.string().uuid(),
  deal_id: z.string().uuid(),
  activity_type: DealActivityType,
  description: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string(),
  created_by: z.string().uuid().nullable(),
});

export type DealActivity = z.infer<typeof DealActivitySchema>;

// Parse with fallback for Supabase data
export function parseDeal(data: unknown): Deal | null {
  const result = DealSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function parseDeals(data: unknown): Deal[] {
  if (!Array.isArray(data)) return [];
  return data.map(parseDeal).filter((d): d is Deal => d !== null);
}

export function parseActivity(data: unknown): DealActivity | null {
  const result = DealActivitySchema.safeParse(data);
  return result.success ? result.data : null;
}

export function parseActivities(data: unknown): DealActivity[] {
  if (!Array.isArray(data)) return [];
  return data.map(parseActivity).filter((a): a is DealActivity => a !== null);
}
