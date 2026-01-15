import { createClient } from "@/lib/supabase/server";
import { Search as SearchIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchCard } from "./_components/search-card";
import { NewSearchDialog } from "./_components/new-search-dialog";
import type { SearchWithRelations } from "./_lib/types";
import { isProcessing } from "./_lib/utils";

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

  const pending = searches.filter((s) => isProcessing(s.status));
  const ready = searches.filter((s) => s.status === "ready");
  const withCampaign = searches.filter((s) => s.campaigns?.length > 0);

  return (
    <div className="p-4 sm:p-6 pb-8">
      <Header />
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="all" className="text-xs sm:text-sm">All ({searches.length})</TabsTrigger>
          <TabsTrigger value="pending" className="text-xs sm:text-sm">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="ready" className="text-xs sm:text-sm">Ready ({ready.length})</TabsTrigger>
          <TabsTrigger value="campaigns" className="text-xs sm:text-sm whitespace-nowrap">Has Campaign ({withCampaign.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <SearchList searches={searches} />
        </TabsContent>
        <TabsContent value="pending">
          <SearchList searches={pending} empty="No searches currently processing" />
        </TabsContent>
        <TabsContent value="ready">
          <SearchList searches={ready} empty="No searches ready for campaign creation" />
        </TabsContent>
        <TabsContent value="campaigns">
          <SearchList searches={withCampaign} empty="No searches with campaigns yet" />
        </TabsContent>
      </Tabs>
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

interface SearchListProps {
  searches: SearchWithRelations[];
  empty?: string;
}

function SearchList({ searches, empty = "No searches found" }: SearchListProps) {
  if (searches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 border rounded-lg bg-muted/20">
        <SearchIcon className="h-10 w-10 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">{empty}</p>
        <p className="text-sm text-muted-foreground mt-1">Create a new search to get started</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {searches.map((search) => (
        <SearchCard key={search.id} search={search} />
      ))}
    </div>
  );
}
