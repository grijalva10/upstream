// Entity types for data tables
// Separated from columns.tsx to allow Server Components to import

export interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  status: string;
  is_buyer: boolean | null;
  is_seller: boolean | null;
  is_decision_maker: boolean | null;
  company: { id: string; name: string } | null;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  phone: string | null;
  website: string | null;
  status: string;
  is_buyer: boolean | null;
  is_seller: boolean | null;
  contact_count: number;
  property_count: number;
  created_at: string;
}

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
