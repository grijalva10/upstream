/**
 * CoStar Persist Layer - Handles DB persistence for CoStar query results.
 *
 * This layer receives JSON from CoStar queries and persists to the database.
 * Separation of concerns: CoStar integration only returns data, this layer saves it.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

const supabase = createClient(
  config.supabaseUrl,
  config.supabaseServiceKey
);

export interface SellerContact {
  // Property info
  property_id: number;
  property_address: string;
  property_type: string;
  building_size?: number;
  land_size?: number;
  year_built?: number;
  market_id?: number;

  // Company info
  company_id: number;
  company_name: string;
  company_address?: string;
  company_phone?: string;

  // Contact info
  contact_id: number;
  contact_name: string;
  contact_title?: string;
  email: string;
  phone?: string;

  // Parcel/loan info (optional)
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

export interface PersistResult {
  properties: number;
  companies: number;
  contacts: number;
  loans: number;
  listLinks: number;
  errors: string[];
}

/**
 * Save seller contacts to the database.
 *
 * @param contacts - Array of seller contact objects from find_sellers query
 * @param extractionListId - ID of the extraction list to link properties to
 * @param criteriaId - ID of the client criteria (for tracking)
 * @returns Counts of records created/updated
 */
export async function saveSellers(
  contacts: SellerContact[],
  extractionListId: string,
  criteriaId: string
): Promise<PersistResult> {
  const result: PersistResult = {
    properties: 0,
    companies: 0,
    contacts: 0,
    loans: 0,
    listLinks: 0,
    errors: [],
  };

  // Group contacts by property to avoid duplicate processing
  const propertyMap = new Map<number, SellerContact[]>();
  for (const contact of contacts) {
    const existing = propertyMap.get(contact.property_id) || [];
    existing.push(contact);
    propertyMap.set(contact.property_id, existing);
  }

  for (const [propertyId, propertyContacts] of propertyMap) {
    try {
      const firstContact = propertyContacts[0];

      // 1. Upsert property
      const { error: propError } = await supabase
        .from("properties")
        .upsert(
          {
            costar_property_id: propertyId,
            address: firstContact.property_address,
            property_type: firstContact.property_type,
            building_size_sf: firstContact.building_size,
            land_size_sf: firstContact.land_size,
            year_built: firstContact.year_built,
            market_id: firstContact.market_id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "costar_property_id" }
        );

      if (propError) {
        result.errors.push(`Property ${propertyId}: ${propError.message}`);
        continue;
      }
      result.properties++;

      // Get property UUID
      const { data: propData } = await supabase
        .from("properties")
        .select("id")
        .eq("costar_property_id", propertyId)
        .single();

      if (!propData) continue;
      const propertyUuid = propData.id;

      // 2. Upsert company
      const { error: compError } = await supabase
        .from("companies")
        .upsert(
          {
            costar_company_id: firstContact.company_id,
            name: firstContact.company_name,
            address: firstContact.company_address,
            phone: firstContact.company_phone,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "costar_company_id" }
        );

      if (compError) {
        result.errors.push(`Company ${firstContact.company_id}: ${compError.message}`);
      } else {
        result.companies++;
      }

      // Get company UUID
      const { data: compData } = await supabase
        .from("companies")
        .select("id")
        .eq("costar_company_id", firstContact.company_id)
        .single();

      const companyUuid = compData?.id;

      // 3. Upsert contacts
      for (const contact of propertyContacts) {
        const { error: contactError } = await supabase
          .from("contacts")
          .upsert(
            {
              costar_person_id: contact.contact_id,
              company_id: companyUuid,
              name: contact.contact_name,
              title: contact.contact_title,
              email: contact.email,
              phone: contact.phone,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "costar_person_id" }
          );

        if (contactError) {
          result.errors.push(`Contact ${contact.contact_id}: ${contactError.message}`);
        } else {
          result.contacts++;
        }
      }

      // 4. Link property to extraction list
      const { error: linkError } = await supabase
        .from("list_properties")
        .upsert(
          {
            extraction_list_id: extractionListId,
            property_id: propertyUuid,
          },
          { onConflict: "extraction_list_id,property_id" }
        );

      if (!linkError) {
        result.listLinks++;
      }

      // 5. Save loan data if present
      if (firstContact.loan_amount) {
        const { error: loanError } = await supabase
          .from("property_loans")
          .upsert(
            {
              property_id: propertyUuid,
              lender: firstContact.lender,
              original_amount: firstContact.loan_amount,
              interest_rate: firstContact.loan_rate,
              term_months: firstContact.loan_term_months,
              origination_date: firstContact.loan_origination,
              ltv_at_origination: firstContact.ltv,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "property_id,lender,origination_date" }
          );

        if (!loanError) {
          result.loans++;
        }
      }

      // 6. Link property to company
      if (companyUuid) {
        await supabase
          .from("property_companies")
          .upsert(
            {
              property_id: propertyUuid,
              company_id: companyUuid,
              role: "owner",
            },
            { onConflict: "property_id,company_id,role" }
          );
      }
    } catch (err) {
      result.errors.push(`Property ${propertyId}: ${String(err)}`);
    }
  }

  // Update extraction list counts
  await supabase
    .from("extraction_lists")
    .update({
      property_count: result.properties,
      contact_count: result.contacts,
      extracted_at: new Date().toISOString(),
    })
    .eq("id", extractionListId);

  // Update criteria totals
  const { data: allLists } = await supabase
    .from("extraction_lists")
    .select("property_count, contact_count")
    .eq("client_criteria_id", criteriaId);

  if (allLists) {
    const totalProps = allLists.reduce((sum, l) => sum + (l.property_count || 0), 0);
    const totalContacts = allLists.reduce((sum, l) => sum + (l.contact_count || 0), 0);

    await supabase
      .from("client_criteria")
      .update({
        total_properties: totalProps,
        total_contacts: totalContacts,
        last_extracted_at: new Date().toISOString(),
      })
      .eq("id", criteriaId);
  }

  return result;
}

/**
 * Create an extraction list record for a query.
 */
export async function createExtractionList(
  criteriaId: string,
  queryName: string,
  queryIndex: number,
  payload: Record<string, unknown>
): Promise<string> {
  const { data, error } = await supabase
    .from("extraction_lists")
    .insert({
      client_criteria_id: criteriaId,
      name: queryName,
      query_index: queryIndex,
      payload_json: payload,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create extraction list: ${error.message}`);
  }

  return data.id;
}

/**
 * Update extraction list status.
 */
export async function updateExtractionListStatus(
  listId: string,
  status: "pending" | "extracting" | "completed" | "failed",
  error?: string
): Promise<void> {
  await supabase
    .from("extraction_lists")
    .update({
      status,
      error_message: error,
      ...(status === "completed" ? { extracted_at: new Date().toISOString() } : {}),
    })
    .eq("id", listId);
}

/**
 * Log a CoStar query execution for audit purposes.
 */
export async function logQueryExecution(
  queryType: string,
  criteriaId: string | null,
  metrics: Record<string, unknown>,
  durationMs: number,
  status: "completed" | "failed" = "completed"
): Promise<string> {
  const { data, error } = await supabase
    .from("agent_executions")
    .insert({
      agent_name: `costar-${queryType}`,
      status,
      metrics,
      duration_ms: durationMs,
      trigger_entity_type: criteriaId ? "client_criteria" : null,
      trigger_entity_id: criteriaId,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to log query execution:", error);
    return "";
  }

  return data.id;
}
