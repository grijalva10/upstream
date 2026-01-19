import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Users, Mail, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchHeader } from "./_components/search-header";
import { CriteriaSection } from "./_components/criteria-section";
import { StrategySection } from "./_components/strategy-section";
import { ResultsSection } from "./_components/results-section";
import { CampaignSection } from "./_components/campaign-section";
import { AgentRunner } from "./_components/agent-runner";
import { SearchErrorBoundary } from "./_components/error-boundary";
import type { SearchWithRelations, SearchContact } from "../_lib/types";

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
      .select("id, name, email")
      .eq("id", data.source_contact_id)
      .single();
    sourceContact = contact;
  }

  return { ...data, source_contact: sourceContact } as SearchWithRelations & { source_contact: SearchContact | null };
}

export default async function SearchDetailPage({ params }: PageProps) {
  const { id } = await params;
  const search = await getSearch(id);

  const isDraft = search.status === "draft";
  const hasResults = (search.total_properties ?? 0) > 0;
  const hasCampaigns = (search.campaigns?.length ?? 0) > 0;

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link
            href="/searches"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Searches
          </Link>
          {hasResults && (
            <div className="flex items-center gap-4 text-sm">
              <Link href={`/data/properties?search=${id}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                <Building2 className="h-3.5 w-3.5" />
                <span className="font-medium">{search.total_properties?.toLocaleString()}</span>
                <span className="hidden sm:inline">properties</span>
              </Link>
              <Link href={`/data/leads?search=${id}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                <Users className="h-3.5 w-3.5" />
                <span className="font-medium">{search.total_leads?.toLocaleString()}</span>
                <span className="hidden sm:inline">leads</span>
              </Link>
              <Link href={`/data/contacts?search=${id}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                <Mail className="h-3.5 w-3.5" />
                <span className="font-medium">{search.total_contacts?.toLocaleString()}</span>
                <span className="hidden sm:inline">contacts</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      <SearchErrorBoundary>
        <div className="px-4 sm:px-6 py-6 max-w-5xl space-y-8">
          {/* Header */}
          <SearchHeader search={search} />

          {/* Draft state - show agent runner */}
          {isDraft && (
            <AgentRunner
              searchId={search.id}
              searchName={search.name}
              initialCriteria={search.criteria_json}
            />
          )}

          {/* Main content - only show when not draft */}
          {!isDraft && (
            <>
              {/* Criteria */}
              <CriteriaSection criteria={search.criteria_json} />

              {/* Strategy & Extraction */}
              <StrategySection
                searchId={search.id}
                strategySummary={search.strategy_summary}
                payloadsJson={search.payloads_json?.queries ?? null}
                status={search.status}
              />

              {/* Results */}
              {hasResults && (
                <ResultsSection
                  searchId={search.id}
                  totalProperties={search.total_properties}
                  totalLeads={search.total_leads}
                  totalContacts={search.total_contacts}
                />
              )}

              {/* Campaign */}
              {hasCampaigns && (
                <CampaignSection campaigns={search.campaigns ?? []} />
              )}
            </>
          )}
        </div>
      </SearchErrorBoundary>
    </div>
  );
}
