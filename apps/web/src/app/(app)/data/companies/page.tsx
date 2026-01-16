import { createAdminClient } from "@/lib/supabase/admin";
import { CompaniesDataTable } from "../_components/companies-data-table";
import type { Company } from "../_components/types";

export default async function CompaniesPage() {
  const supabase = createAdminClient();

  const { data, count } = await supabase
    .from("companies")
    .select("*, contacts(id), property_companies(property_id)", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(20);

  const companies: Company[] = (data || []).map((c) => ({
    ...c,
    contact_count: c.contacts?.length || 0,
    property_count: c.property_companies?.length || 0,
  }));

  return (
    <div className="p-6 pb-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Companies</h1>
        <p className="text-sm text-muted-foreground">
          Property owners and organizations
        </p>
      </div>

      <CompaniesDataTable data={companies} total={count || 0} />
    </div>
  );
}
