import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const COSTAR_SERVICE_URL = process.env.COSTAR_SERVICE_URL || "http://localhost:8765";

interface ExtractedContact {
  // Core identifiers
  property_id: number;
  property_address: string;

  // Property type
  property_type: string;
  property_type_id?: number;
  secondary_type?: string;

  // Size/age
  building_size: string | number;
  land_size: string | number;
  year_built: number | string;

  // Location
  city?: string;
  state_code?: string;
  postal_code?: string;
  county?: string;
  submarket?: string;
  submarket_cluster?: string;
  market_id: number | null;

  // Building characteristics
  building_class?: string;
  building_status?: string;
  star_rating?: number;
  tenancy?: string;
  number_of_stories?: number;
  ceiling_height?: string;
  zoning?: string;

  // Parking
  parking_ratio?: number;
  parking_spaces?: number;

  // Industrial-specific
  docks?: string;
  drive_ins?: string;
  power?: string;
  rail?: string;
  crane?: string;

  // Multifamily-specific
  num_of_beds?: number;

  // Sale info
  last_sale_date?: string;
  last_sale_price?: number;

  // Management
  property_manager?: string;

  // Leasing
  percent_leased?: number;
  available_sf?: number;

  // Company/Owner
  company_id: number;
  company_name: string;
  company_costar_key?: string;
  company_type?: number;
  company_address: string;
  company_phone: string;

  // Contact
  contact_id: number;
  contact_name: string;
  contact_title: string;
  email: string;
  phone: string;

  // Parcel/loan data (when include_parcel: true)
  apn?: string;
  lot_size_sf?: number;
  sale_date?: string;
  sale_price?: number;
  seller?: string;
  ltv?: number;
  lender?: string;
  loan_amount?: number;
  loan_rate?: number;
  loan_term_months?: number;
  loan_origination?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const maxProperties = body.max_properties ?? 100;

    const supabase = createAdminClient();

    // Get search with payloads
    const { data: search, error: fetchError } = await supabase
      .from("searches")
      .select("id, name, payloads_json, status")
      .eq("id", id)
      .single();

    if (fetchError || !search) {
      return NextResponse.json({ error: "Search not found" }, { status: 404 });
    }

    const payloads = search.payloads_json?.queries;
    if (!payloads?.length) {
      return NextResponse.json(
        { error: "No payloads to extract. Run the sourcing agent first." },
        { status: 400 }
      );
    }

    // Check CoStar service status
    let serviceStatus;
    try {
      const statusRes = await fetch(`${COSTAR_SERVICE_URL}/status`);
      serviceStatus = await statusRes.json();
    } catch {
      return NextResponse.json(
        { error: "CoStar service not available. Start it with: python integrations/costar/service.py" },
        { status: 503 }
      );
    }

    if (serviceStatus.status !== "connected") {
      return NextResponse.json(
        {
          error: `CoStar session not connected. Status: ${serviceStatus.status}`,
          costar_status: serviceStatus
        },
        { status: 503 }
      );
    }

    if (!serviceStatus.session_valid) {
      return NextResponse.json(
        {
          error: "CoStar session expired. Please re-authenticate.",
          costar_status: serviceStatus
        },
        { status: 401 }
      );
    }

    // Update search status
    await supabase
      .from("searches")
      .update({ status: "extracting" })
      .eq("id", id);

    // Extract payloads (just the payload objects)
    console.log("Raw payloads:", JSON.stringify(payloads[0], null, 2));
    const payloadObjects = payloads.map((p: { payload?: unknown }) => p.payload ?? p);
    console.log("Sending payloads:", payloadObjects.length);

    // Run extraction
    const extractRes = await fetch(`${COSTAR_SERVICE_URL}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query_type: "find_sellers",
        payload: payloadObjects,
        options: {
          max_properties: maxProperties,
          require_email: true,
          include_parcel: true,
          timeout: 600,
        },
      }),
    });

    if (!extractRes.ok) {
      const error = await extractRes.json().catch(() => ({ error: "Extraction failed" }));

      await supabase
        .from("searches")
        .update({ status: "failed" })
        .eq("id", id);

      return NextResponse.json(
        { error: error.error || "Extraction failed" },
        { status: extractRes.status }
      );
    }

    const result = await extractRes.json();

    // Handle both response formats: {contacts: [...]} or {data: {contacts: [...]}}
    const contacts: ExtractedContact[] = result.contacts || result.data?.contacts || [];
    console.log(`Found ${contacts.length} contacts to upsert`);

    // Upsert extracted data
    const stats = await upsertExtractedData(supabase, id, contacts);

    // Update search with results
    await supabase
      .from("searches")
      .update({
        status: "extraction_complete",
        total_properties: stats.properties,
        total_companies: stats.companies,
        total_contacts: stats.contacts,
      })
      .eq("id", id);

    return NextResponse.json({
      success: true,
      properties: stats.properties,
      companies: stats.companies,
      contacts: stats.contacts,
      loans: stats.loans,
    });

  } catch (error) {
    console.error("Run extraction error:", error);
    return NextResponse.json(
      { error: "Failed to run extraction", details: String(error) },
      { status: 500 }
    );
  }
}

async function upsertExtractedData(
  supabase: ReturnType<typeof createAdminClient>,
  searchId: string,
  contacts: ExtractedContact[]
) {
  const propertyMap = new Map<number, string>(); // costar_id -> uuid
  const companyMap = new Map<number, string>(); // costar_id -> uuid
  const contactCount = { inserted: 0, updated: 0 };

  // Group contacts by property and company for deduplication
  const uniqueProperties = new Map<number, ExtractedContact>();
  const uniqueCompanies = new Map<number, ExtractedContact>();

  for (const contact of contacts) {
    if (contact.property_id && !uniqueProperties.has(contact.property_id)) {
      uniqueProperties.set(contact.property_id, contact);
    }
    if (contact.company_id && !uniqueCompanies.has(contact.company_id)) {
      uniqueCompanies.set(contact.company_id, contact);
    }
  }

  // 1. Upsert properties with all available fields
  console.log(`Upserting ${uniqueProperties.size} unique properties...`);
  for (const [costarId, contact] of uniqueProperties) {
    const propertyData = {
      costar_property_id: String(costarId),
      address: contact.property_address || "Unknown",

      // Property type
      property_type: mapPropertyType(contact.property_type),
      secondary_type: contact.secondary_type || null,

      // Size/age
      building_size_sqft: parseSqft(contact.building_size),
      lot_size_acres: parseFloat(String(contact.land_size)) || null,
      year_built: parseYear(contact.year_built),

      // Location fields
      city: contact.city || null,
      state_code: contact.state_code || null,
      postal_code: contact.postal_code || null,
      county: contact.county || null,
      submarket: contact.submarket || null,
      submarket_cluster: contact.submarket_cluster || null,

      // Building characteristics
      building_class: contact.building_class || null,
      building_status: contact.building_status || null,
      star_rating: contact.star_rating || null,
      tenancy: contact.tenancy || null,
      number_of_stories: contact.number_of_stories || null,
      ceiling_height: contact.ceiling_height || null,
      zoning: contact.zoning || null,

      // Parking
      parking_ratio: contact.parking_ratio || null,
      parking_spaces: contact.parking_spaces || null,

      // Industrial-specific
      docks: contact.docks || null,
      drive_ins: contact.drive_ins || null,
      power: contact.power || null,
      rail: contact.rail || null,
      crane: contact.crane || null,

      // Multifamily-specific
      num_of_beds: contact.num_of_beds || null,

      // Sale info
      last_sale_date: parseDate(contact.last_sale_date) || null,
      last_sale_price: contact.last_sale_price || null,

      // Management
      property_manager: contact.property_manager || null,

      // Leasing
      available_sf: contact.available_sf || null,

      last_seen_at: new Date().toISOString(),
    };

    console.log(`Upserting property ${costarId}:`, propertyData.address, propertyData.city, propertyData.state_code);

    const { data: property, error } = await supabase
      .from("properties")
      .upsert(propertyData, {
        onConflict: "costar_property_id",
        ignoreDuplicates: false,
      })
      .select("id")
      .single();

    if (error) {
      console.error(`Failed to upsert property ${costarId}:`, error.message, error.details, error.hint);
    } else if (property) {
      console.log(`Property ${costarId} saved with id ${property.id}`);
      propertyMap.set(costarId, property.id);
    } else {
      console.log(`Property ${costarId} - no data returned, no error`);
    }
  }

  // 2. Upsert companies with TrueOwner data
  for (const [costarId, contact] of uniqueCompanies) {
    const companyData = {
      costar_company_id: String(costarId),
      costar_key: contact.company_costar_key || null,
      company_type: contact.company_type || null,
      name: contact.company_name || "Unknown",
      is_seller: true,
    };

    console.log(`Upserting company ${costarId}:`, companyData.name, companyData.costar_key);

    const { data: company, error } = await supabase
      .from("companies")
      .upsert(companyData, {
        onConflict: "costar_company_id",
        ignoreDuplicates: false,
      })
      .select("id")
      .single();

    if (error) {
      console.error(`Failed to upsert company ${costarId}:`, error.message, companyData);
    } else if (company) {
      companyMap.set(costarId, company.id);
    }
  }

  // 3. Upsert contacts (by email)
  for (const contact of contacts) {
    if (!contact.email) continue;

    const companyUuid = contact.company_id ? companyMap.get(contact.company_id) : null;

    const { error } = await supabase
      .from("contacts")
      .upsert({
        costar_person_id: contact.contact_id ? String(contact.contact_id) : null,
        company_id: companyUuid,
        name: contact.contact_name || "Unknown",
        title: contact.contact_title,
        email: contact.email.toLowerCase(),
        phone: contact.phone,
        is_seller: true,
      }, {
        onConflict: "email",
        ignoreDuplicates: false,
      });

    if (!error) {
      contactCount.inserted++;
    }
  }

  // 4. Create property_companies junctions
  for (const contact of contacts) {
    if (!contact.property_id || !contact.company_id) continue;

    const propertyUuid = propertyMap.get(contact.property_id);
    const companyUuid = companyMap.get(contact.company_id);

    if (propertyUuid && companyUuid) {
      await supabase
        .from("property_companies")
        .upsert({
          property_id: propertyUuid,
          company_id: companyUuid,
          relationship: "owner",
        }, {
          onConflict: "property_id,company_id",
          ignoreDuplicates: true,
        });
    }
  }

  // 5. Link properties to search
  for (const propertyUuid of propertyMap.values()) {
    await supabase
      .from("search_properties")
      .upsert({
        search_id: searchId,
        property_id: propertyUuid,
      }, {
        onConflict: "search_id,property_id",
        ignoreDuplicates: true,
      });
  }

  // 6. Upsert loan data (if available from parcel)
  let loansCreated = 0;
  for (const contact of contacts) {
    if (!contact.property_id || !contact.lender) continue;

    const propertyUuid = propertyMap.get(contact.property_id);
    if (!propertyUuid) continue;

    const loanData = {
      property_id: propertyUuid,
      lender_name: contact.lender,
      original_amount: contact.loan_amount,
      interest_rate: contact.loan_rate,
      origination_date: parseDate(contact.loan_origination),
      ltv_original: contact.ltv,
    };

    const { error } = await supabase
      .from("property_loans")
      .upsert(loanData, {
        onConflict: "property_id",
        ignoreDuplicates: false,
      });

    if (error) {
      console.error(`Failed to upsert loan for property ${contact.property_id}:`, error.message);
    } else {
      loansCreated++;
    }
  }

  return {
    properties: propertyMap.size,
    companies: companyMap.size,
    contacts: contactCount.inserted,
    loans: loansCreated,
  };
}

function parseSqft(size: string | number | null): number | null {
  if (!size) return null;
  if (typeof size === "number") return size;
  // Remove commas and parse "103,440" -> 103440
  const cleaned = size.replace(/[^0-9.]/g, "");
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? null : parsed;
}

function parseYear(year: string | number | null): number | null {
  if (!year) return null;
  if (typeof year === "number") return year;
  const parsed = parseInt(year, 10);
  return isNaN(parsed) ? null : parsed;
}

function parseDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  // Try to parse various date formats
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0]; // Return YYYY-MM-DD
}

// CoStar property type IDs to names
const PROPERTY_TYPE_MAP: Record<number, string> = {
  1: "Office",
  2: "Industrial",
  3: "Retail",
  4: "Multifamily",
  5: "Hospitality",
  6: "Land",
  7: "Healthcare",
  8: "Mixed Use",
};

// Known property type names (to detect if we already have a name string)
const PROPERTY_TYPE_NAMES = new Set(Object.values(PROPERTY_TYPE_MAP).map(n => n.toLowerCase()));

function mapPropertyType(typeId: string | number | null): string | null {
  if (!typeId) return null;

  // If it's a string, check if it's already a property type name
  if (typeof typeId === "string") {
    if (PROPERTY_TYPE_NAMES.has(typeId.toLowerCase())) {
      return typeId; // Already a name, return as-is
    }
    // Try to parse as number
    const id = parseInt(typeId, 10);
    if (!isNaN(id) && PROPERTY_TYPE_MAP[id]) {
      return PROPERTY_TYPE_MAP[id];
    }
    return typeId; // Return the string as-is
  }

  // It's a number, look up the name
  return PROPERTY_TYPE_MAP[typeId] || String(typeId);
}

// GET endpoint to check CoStar service status
export async function GET() {
  try {
    const statusRes = await fetch(`${COSTAR_SERVICE_URL}/status`);
    if (!statusRes.ok) {
      return NextResponse.json({
        available: false,
        status: "offline",
        error: "Service not responding"
      });
    }
    const status = await statusRes.json();
    return NextResponse.json({
      available: true,
      ...status,
    });
  } catch {
    return NextResponse.json({
      available: false,
      status: "offline",
      error: "Service not available"
    });
  }
}
