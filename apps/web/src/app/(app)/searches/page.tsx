import { createClient } from "@/lib/supabase/server";
import { SearchesDataTable } from "./_components/searches-data-table";
import { NewSearchDialog } from "./_components/new-search-dialog";
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
    <div className="p-4 sm:p-6 pb-8">
      <Header />
      <SearchesDataTable data={searches} />
    </div>
  );
}

function Header() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Searches</h1>
        <p className="text-sm text-muted-foreground">
          Create and manage property searches from buyer criteria
        </p>
      </div>
      <NewSearchDialog />
    </div>
  );
}
