// Entity types for data tables
// Separated from columns.tsx to allow Server Components to import

export interface Contact {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  status: string;
  is_buyer: boolean | null;
  is_seller: boolean | null;
  is_decision_maker: boolean | null;
  lead: { id: string; name: string } | null;
  created_at: string;
}

export interface Lead {
  id: string;
  costar_company_id: string | null;
  name: string;
  status: string;
  lead_type: string;
  source: string | null;
  notes: string | null;
  closed_reason: string | null;
  contact_count: number;
  property_count: number;
  created_at: string;
  last_contacted_at: string | null;
}

// Alias for backwards compatibility
export type Company = Lead;

export interface Property {
  id: string;
  costar_property_id: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  property_type: string | null;
  building_class: string | null;
  building_size_sqft: number | null;
  lot_size_acres: number | null;
  year_built: number | null;
  units: number | null;
  floors: number | null;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  search: { id: string; name: string } | null;
  total_enrolled: number | null;
  total_sent: number | null;
  total_opened: number | null;
  total_replied: number | null;
  total_stopped: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface Exclusion {
  id: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  reason: string | null;
  source: string | null;
  added_at: string;
  notes: string | null;
}
