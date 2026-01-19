"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { DealStatus, parseDeal, parseActivity, type DealActivity } from "./schema";

// Shared query for fetching deals with relations
const DEAL_SELECT = `
  *,
  properties (id, address, property_type, building_size_sqft, building_class, year_built),
  leads (id, name),
  contacts (id, name, email, phone),
  searches (id, name)
`;

// --- Mutations ---

export async function updateDealStatus(dealId: string, status: DealStatus) {
  const supabase = await createClient();

  // Get current status
  const { data: current } = await supabase
    .from("deals")
    .select("status")
    .eq("id", dealId)
    .single();

  if (!current || current.status === status) {
    return { success: true };
  }

  // Update status
  const { error } = await supabase
    .from("deals")
    .update({ status })
    .eq("id", dealId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Log activity
  await supabase.from("deal_activity").insert({
    deal_id: dealId,
    activity_type: status === "handed_off" ? "handed_off" : "status_change",
    description: `Status: ${current.status} → ${status}`,
    metadata: { previous: current.status, new: status },
  });

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${dealId}`);

  return { success: true };
}

// Schema for deal field updates
const UpdateDealInput = z.object({
  asking_price: z.number().nullable().optional(),
  noi: z.number().nullable().optional(),
  cap_rate: z.number().nullable().optional(),
  motivation: z.string().nullable().optional(),
  timeline: z.string().nullable().optional(),
  decision_maker_confirmed: z.boolean().optional(),
  price_realistic: z.boolean().nullable().optional(),
  rent_roll_url: z.string().nullable().optional(),
  operating_statement_url: z.string().nullable().optional(),
  other_docs: z.array(z.object({ name: z.string(), url: z.string() })).nullable().optional(),
  loan_amount: z.number().nullable().optional(),
  loan_maturity: z.string().nullable().optional(),
  loan_rate: z.number().nullable().optional(),
  lender_name: z.string().nullable().optional(),
  investment_summary: z.string().nullable().optional(),
  investment_highlights: z.array(z.string()).nullable().optional(),
  admin_notes: z.string().nullable().optional(),
});

export async function updateDeal(dealId: string, input: z.infer<typeof UpdateDealInput>) {
  const parsed = UpdateDealInput.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input" };
  }

  const updates = parsed.data;

  // Auto-calculate cap rate
  if (updates.asking_price && updates.noi) {
    updates.cap_rate = (updates.noi / updates.asking_price) * 100;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("deals")
    .update(updates)
    .eq("id", dealId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/pipeline/${dealId}`);
  return { success: true };
}

export async function addNote(dealId: string, note: string) {
  if (!note.trim()) {
    return { success: false, error: "Note cannot be empty" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("deal_activity").insert({
    deal_id: dealId,
    activity_type: "note_added",
    description: note.trim(),
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/pipeline/${dealId}`);
  return { success: true };
}

export async function createDeal(propertyId: string, leadId?: string, contactId?: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deals")
    .insert({
      property_id: propertyId,
      lead_id: leadId || null,
      contact_id: contactId || null,
      status: "qualifying",
    })
    .select(DEAL_SELECT)
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // Log creation
  await supabase.from("deal_activity").insert({
    deal_id: data.id,
    activity_type: "status_change",
    description: "Deal created",
  });

  revalidatePath("/pipeline");
  return { success: true, deal: parseDeal(data) };
}

export async function generatePackage(dealId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deals")
    .select(`*, properties (*), leads (*), contacts (*)`)
    .eq("id", dealId)
    .single();

  if (error || !data) {
    return { success: false, error: "Deal not found" };
  }

  const pkg = {
    display_id: data.display_id,
    property: {
      address: data.properties?.address,
      type: data.properties?.property_type,
      sqft: data.properties?.building_size_sqft,
      year_built: data.properties?.year_built,
    },
    seller: {
      company: data.leads?.name,
      contact: data.contacts?.name,
      email: data.contacts?.email,
      phone: data.contacts?.phone,
    },
    pricing: {
      asking_price: data.asking_price,
      noi: data.noi,
      cap_rate: data.cap_rate,
    },
    motivation: data.motivation,
    timeline: data.timeline,
    loan: {
      amount: data.loan_amount,
      maturity: data.loan_maturity,
      rate: data.loan_rate,
      lender: data.lender_name,
    },
    investment_summary: data.investment_summary,
    investment_highlights: data.investment_highlights,
    documents: {
      rent_roll_url: data.rent_roll_url,
      operating_statement_url: data.operating_statement_url,
    },
  };

  // Update status if qualified
  if (data.status === "qualified") {
    await supabase.from("deals").update({ status: "packaged" }).eq("id", dealId);
    await supabase.from("deal_activity").insert({
      deal_id: dealId,
      activity_type: "status_change",
      description: "Deal packaged",
    });
    revalidatePath("/pipeline");
    revalidatePath(`/pipeline/${dealId}`);
  }

  return { success: true, package: pkg };
}

// --- Queries ---

export async function getDeals(filters?: { search?: string; searchId?: string }) {
  const supabase = await createClient();

  let query = supabase
    .from("deals")
    .select(DEAL_SELECT)
    .order("updated_at", { ascending: false });

  if (filters?.searchId) {
    query = query.eq("search_id", filters.searchId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch deals:", error);
    return [];
  }

  let deals = data ?? [];

  // Client-side text search (searches across relations)
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    deals = deals.filter(
      (d) =>
        d.display_id?.toLowerCase().includes(q) ||
        d.properties?.address?.toLowerCase().includes(q) ||
        d.leads?.name?.toLowerCase().includes(q)
    );
  }

  return deals;
}

export async function getDeal(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deals")
    .select(`*, properties (*), leads (*), contacts (*), searches (id, name)`)
    .eq("id", id)
    .single();

  if (error) return null;
  return parseDeal(data);
}

export async function getDealActivities(dealId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("deal_activity")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });

  return (data ?? []).map(parseActivity).filter((a): a is DealActivity => a !== null);
}

export async function getSearches() {
  const supabase = await createClient();
  const { data } = await supabase.from("searches").select("id, name").order("name");
  return data ?? [];
}

export async function searchProperties(query: string) {
  if (query.length < 2) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("properties")
    .select("id, address, property_type, building_size_sqft")
    .ilike("address", `%${query}%`)
    .limit(10);

  return data ?? [];
}
