// Lead status values from schema
export const LEAD_STATUSES = [
  "new",
  "contacted",
  "replied",
  "engaged",
  "waiting",
  "qualified",
  "handed_off",
  "nurture",
  "closed",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

// Lead type values
export const LEAD_TYPES = [
  "seller",
  "buyer",
  "buyer_seller",
  "broker",
  "other",
] as const;

export type LeadType = (typeof LEAD_TYPES)[number];

// Contact within a lead
export interface LeadContact {
  id: string;
  name: string;
  email: string | null;
}

// Lead with related data (as returned by API/queries)
export interface LeadWithRelations {
  id: string;
  name: string;
  status: LeadStatus;
  lead_type: LeadType;
  source: string | null;
  created_at: string;
  contacts: LeadContact[];
  property_count: number;
  last_activity_at: string | null;
}
