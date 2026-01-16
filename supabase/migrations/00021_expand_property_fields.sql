-- Expand properties table with all CoStar search result fields
-- This captures the rich data returned by list-properties endpoint

-- Location fields
ALTER TABLE properties ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS state_code TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS county TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS submarket TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS submarket_cluster TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS location_type TEXT;

-- Building characteristics
ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_status TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS star_rating INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS secondary_type TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS tenancy TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS number_of_stories INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS ceiling_height TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_park TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS zoning TEXT;

-- Parking
ALTER TABLE properties ADD COLUMN IF NOT EXISTS parking_ratio DECIMAL(5,2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS parking_spaces INTEGER;

-- Industrial-specific
ALTER TABLE properties ADD COLUMN IF NOT EXISTS docks TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS drive_ins TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS power TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS rail TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS crane TEXT;

-- Multifamily-specific
ALTER TABLE properties ADD COLUMN IF NOT EXISTS num_of_beds INTEGER;

-- Sale info
ALTER TABLE properties ADD COLUMN IF NOT EXISTS last_sale_date DATE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS last_sale_price DECIMAL(15,2);

-- Management
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_manager TEXT;

-- Flood info
ALTER TABLE properties ADD COLUMN IF NOT EXISTS flood_risk TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS flood_zone TEXT;

-- Leasing info
ALTER TABLE properties ADD COLUMN IF NOT EXISTS available_sf INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS asking_rent TEXT;

-- Raw JSON for any fields we don't have columns for
ALTER TABLE properties ADD COLUMN IF NOT EXISTS costar_data JSONB;

-- Expand companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS costar_key TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_type INTEGER; -- CoStar type field (1 = company, 0 = person?)

-- Create index on costar_key for lookups
CREATE INDEX IF NOT EXISTS idx_companies_costar_key ON companies(costar_key);

-- Add indexes for common search fields
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_state ON properties(state_code);
CREATE INDEX IF NOT EXISTS idx_properties_submarket ON properties(submarket);
CREATE INDEX IF NOT EXISTS idx_properties_building_class ON properties(building_class);
