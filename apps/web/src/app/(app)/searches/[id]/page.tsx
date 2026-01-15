import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { OverviewTab } from "./_components/overview-tab";
import { StrategyTab } from "./_components/strategy-tab";
import { ResultsTab } from "./_components/results-tab";
import { CampaignTab } from "./_components/campaign-tab";
import { SearchErrorBoundary } from "./_components/error-boundary";
import { DeleteButton } from "./_components/delete-button";
import { RetryButton } from "./_components/retry-button";
import type { SearchWithRelations, SearchContact } from "../_lib/types";
import { StatusBadge, getSourceLabel } from "../_lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getSearch(id: string): Promise<SearchWithRelations & { source_contact: SearchContact | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("searches")
    .select(`
      *,
      campaigns (id, name, status, total_enrolled, total_sent, total_opened, total_replied)
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    notFound();
  }

  let sourceContact: SearchContact | null = null;
  if (data.source_contact_id) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, email")
      .eq("id", data.source_contact_id)
      .single();
    sourceContact = contact;
  }

  return { ...data, source_contact: sourceContact } as SearchWithRelations & { source_contact: SearchContact | null };
}

export default async function SearchDetailPage({ params }: PageProps) {
  const { id } = await params;
  const search = await getSearch(id);

  return (
    <div className="p-4 sm:p-6 max-w-6xl">
      <nav aria-label="Breadcrumb">
        <Link
          href="/searches"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" />
          <span className="hidden sm:inline">Back to Searches</span>
          <span className="sm:hidden">Back</span>
        </Link>
      </nav>

      <Header search={search} />

      <SearchErrorBoundary>
        <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6">
          <TabsList aria-label="Search details navigation" className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="strategy" className="text-xs sm:text-sm">Strategy</TabsTrigger>
            <TabsTrigger value="results" className="text-xs sm:text-sm">Results</TabsTrigger>
            <TabsTrigger value="campaign" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              Campaign
              {search.campaigns?.length > 0 && (
                <Badge variant="secondary" className="h-4 sm:h-5 px-1 sm:px-1.5 text-xs">
                  {search.campaigns.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab search={search} />
          </TabsContent>
          <TabsContent value="strategy">
            <StrategyTab
              strategySummary={search.strategy_summary}
              payloadsJson={search.payloads_json}
              status={search.status}
            />
          </TabsContent>
          <TabsContent value="results">
            <ResultsTab
              totalProperties={search.total_properties}
              totalCompanies={search.total_companies}
              totalContacts={search.total_contacts}
              status={search.status}
            />
          </TabsContent>
          <TabsContent value="campaign">
            <CampaignTab campaigns={search.campaigns ?? []} searchStatus={search.status} />
          </TabsContent>
        </Tabs>
      </SearchErrorBoundary>
    </div>
  );
}

interface HeaderProps {
  search: SearchWithRelations & { source_contact: SearchContact | null };
}

function Header({ search }: HeaderProps) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4 sm:mb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{search.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Source: {getSourceLabel(search.source)}
          {search.source_contact && (
            <span className="hidden sm:inline"> from {search.source_contact.first_name} {search.source_contact.last_name}</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={search.status} />
        <RetryButton searchId={search.id} status={search.status} />
        <DeleteButton searchId={search.id} searchName={search.name} />
      </div>
    </header>
  );
}
