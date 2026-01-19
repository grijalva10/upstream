import { createAdminClient } from "@/lib/supabase/admin";
import { LeadsDataTable } from "../_components/leads-data-table";
import type { Lead } from "../_components/types";

export default async function LeadsPage() {
  const supabase = createAdminClient();

  const { data, count } = await supabase
    .from("leads")
    .select("*, contacts(id), property_leads(property_id)", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(20);

  const leads: Lead[] = (data || []).map((l) => ({
    ...l,
    contact_count: l.contacts?.length || 0,
    property_count: l.property_leads?.length || 0,
  }));

  return (
    <div className="p-6 pb-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Leads</h1>
        <p className="text-sm text-muted-foreground">
          Property owners and organizations
        </p>
      </div>

      <LeadsDataTable data={leads} total={count || 0} />
    </div>
  );
}
