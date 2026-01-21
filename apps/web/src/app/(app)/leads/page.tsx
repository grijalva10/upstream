import { createAdminClient } from "@/lib/supabase/admin";
import { PageContainer } from "@/components/layout";
import { PageSetup } from "./_components/page-setup";
import { LeadsDataTable } from "./_components/leads-data-table";
import type { LeadWithRelations } from "./_lib/types";

async function getLeads(): Promise<LeadWithRelations[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("leads")
    .select(
      `
      id,
      name,
      status,
      lead_type,
      source,
      created_at,
      contacts (id, name, email),
      property_leads (property_id)
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch leads:", error);
    return [];
  }

  // Get lead IDs for activity lookup
  const leadIds = data?.map((l: any) => l.id) || [];
  const lastActivityMap = new Map<string, string>();

  if (leadIds.length > 0) {
    // Get latest email per lead
    const { data: emails } = await supabase
      .from("synced_emails")
      .select("matched_lead_id, received_at")
      .in("matched_lead_id", leadIds)
      .order("received_at", { ascending: false });

    // Get latest activity per lead
    const { data: activities } = await supabase
      .from("activities")
      .select("lead_id, activity_at")
      .in("lead_id", leadIds)
      .order("activity_at", { ascending: false });

    // Build map of lead_id -> latest timestamp
    emails?.forEach((e: any) => {
      if (e.matched_lead_id && e.received_at) {
        const existing = lastActivityMap.get(e.matched_lead_id);
        if (!existing || new Date(e.received_at) > new Date(existing)) {
          lastActivityMap.set(e.matched_lead_id, e.received_at);
        }
      }
    });

    activities?.forEach((a: any) => {
      if (a.lead_id && a.activity_at) {
        const existing = lastActivityMap.get(a.lead_id);
        if (!existing || new Date(a.activity_at) > new Date(existing)) {
          lastActivityMap.set(a.lead_id, a.activity_at);
        }
      }
    });
  }

  return (
    data?.map((lead: any) => ({
      id: lead.id,
      name: lead.name,
      status: lead.status,
      lead_type: lead.lead_type,
      source: lead.source,
      created_at: lead.created_at,
      contacts: lead.contacts || [],
      property_count: lead.property_leads?.length || 0,
      last_activity_at: lastActivityMap.get(lead.id) || null,
    })) || []
  );
}

export default async function LeadsPage() {
  const leads = await getLeads();

  return (
    <PageSetup count={leads.length}>
      <PageContainer>
        <LeadsDataTable data={leads} />
      </PageContainer>
    </PageSetup>
  );
}
