import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout";
import { PageSetup } from "./_components/page-setup";
import { SearchesDataTable } from "./_components/searches-data-table";
import type { SearchWithRelations } from "./_lib/types";

async function getSearches(): Promise<SearchWithRelations[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("searches")
    .select(`
      id, name, source, status, criteria_json, strategy_summary,
      payloads_json, total_properties, total_companies, total_contacts,
      source_contact_id, created_at, updated_at,
      campaigns (id, name, status, total_enrolled, total_sent, total_opened, total_replied)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch searches:", error);
    return [];
  }

  return (data ?? []) as SearchWithRelations[];
}

export default async function SearchesPage() {
  const searches = await getSearches();

  return (
    <PageSetup>
      <PageContainer>
        <SearchesDataTable data={searches} />
      </PageContainer>
    </PageSetup>
  );
}
