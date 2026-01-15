import type { Database } from "@/lib/supabase/database.types";

// Database row types
export type SearchRow = Database["public"]["Tables"]["searches"]["Row"];
export type SearchInsert = Database["public"]["Tables"]["searches"]["Insert"];
export type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];
export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];

// Derived types
export type SearchStatus =
  | "pending_queries"
  | "extracting"
  | "ready"
  | "campaign_created";

export type SearchSource =
  | "lee-1031-x"
  | "manual"
  | "inbound";

export interface SearchCampaign {
  id: string;
  name: string;
  status: string;
  total_enrolled: number;
  total_sent: number;
  total_opened: number;
  total_replied: number;
}

export interface SearchContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

// Search with related data (as returned by API/queries)
export interface SearchWithRelations extends Omit<SearchRow, "criteria_json" | "payloads_json"> {
  criteria_json: CriteriaJson;
  payloads_json: CoStarPayload[] | null;
  campaigns: SearchCampaign[];
  source_contact?: SearchContact | null;
}

// Criteria JSON structure
export interface CriteriaJson {
  buyer?: {
    name?: string;
    entityName?: string;
    entity?: Record<string, unknown>;
    contact?: Record<string, unknown>;
  };
  criteria?: CriteriaDetails;
  [key: string]: unknown;
}

export interface CriteriaDetails {
  markets?: string[];
  targetMarkets?: string[];
  propertyTypes?: string[];
  property_types?: string[];
  priceRange?: { min?: number; max?: number };
  capRate?: { min?: number; max?: number };
  sqft?: { min?: number; max?: number };
  strategy?: string;
  deadline?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface CoStarPayload {
  name?: string;
  [key: string]: unknown;
}

export interface ParsedCriteria {
  markets: string[];
  propertyTypes: string[];
  priceRange: { min?: number; max?: number } | null;
  capRate: { min?: number; max?: number } | null;
  sqft: { min?: number; max?: number } | null;
  strategy: string | null;
  deadline: string | null;
  notes: string | null;
}
