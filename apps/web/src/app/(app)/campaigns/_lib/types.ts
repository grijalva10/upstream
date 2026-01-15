import type { Database } from "@/lib/supabase/database.types";

// Database row types
export type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];
export type CampaignInsert = Database["public"]["Tables"]["campaigns"]["Insert"];
export type EnrollmentRow = Database["public"]["Tables"]["enrollments"]["Row"];
export type PropertyRow = Database["public"]["Tables"]["properties"]["Row"];
export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];

// Derived types
export type CampaignStatus = "draft" | "active" | "paused" | "completed";
export type EnrollmentStatus = "pending" | "active" | "replied" | "completed" | "stopped";
export type StopReason = "replied" | "dnc" | "bounce" | "manual";

// Search info for display
export interface CampaignSearch {
  id: string;
  name: string;
}

// Campaign with related search
export interface CampaignWithSearch extends CampaignRow {
  search: CampaignSearch | null;
}

// Contact info for display
export interface EnrollmentContact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company_id: string | null;
}

// Property info for display
export interface EnrollmentProperty {
  id: string;
  address: string | null;
  city: string | null;
  state: string | null;
}

// Enrollment with relations
export interface EnrollmentWithRelations extends EnrollmentRow {
  contact: EnrollmentContact | null;
  property: EnrollmentProperty | null;
}

// Computed metrics for display
export interface CampaignMetrics {
  enrolled: number;
  sent: number;
  sentRate: number;
  opened: number;
  openRate: number;
  replied: number;
  replyRate: number;
  stopped: number;
  stopRate: number;
}

// Email data for display
export interface CampaignEmail {
  number: 1 | 2 | 3;
  subject: string | null;
  body: string | null;
  delayDays: number | null;
}

// Paginated response
export interface PaginatedEnrollments {
  data: EnrollmentWithRelations[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
