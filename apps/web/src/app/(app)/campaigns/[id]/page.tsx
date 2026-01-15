import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { OverviewTab } from "./_components/overview-tab";
import { EmailsTab } from "./_components/emails-tab";
import { EnrollmentsTab } from "./_components/enrollments-tab";
import { ActivityTab } from "./_components/activity-tab";
import { SettingsTab } from "./_components/settings-tab";
import { CampaignErrorBoundary } from "./_components/error-boundary";
import type { CampaignWithSearch } from "../_lib/types";
import { CampaignStatusBadge } from "../_lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getCampaign(id: string): Promise<CampaignWithSearch> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("campaigns")
    .select(`
      *,
      search:searches (id, name)
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    notFound();
  }

  return data as CampaignWithSearch;
}

async function getEnrollmentCount(campaignId: string): Promise<number> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  return count ?? 0;
}

export default async function CampaignDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [campaign, enrollmentCount] = await Promise.all([
    getCampaign(id),
    getEnrollmentCount(id),
  ]);

  return (
    <div className="p-4 sm:p-6 max-w-6xl">
      <nav aria-label="Breadcrumb">
        <Link
          href="/campaigns"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" />
          <span className="hidden sm:inline">Back to Campaigns</span>
          <span className="sm:hidden">Back</span>
        </Link>
      </nav>

      <Header campaign={campaign} />

      <CampaignErrorBoundary>
        <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6">
          <TabsList aria-label="Campaign details navigation" className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="emails" className="text-xs sm:text-sm">Emails</TabsTrigger>
            <TabsTrigger value="enrollments" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              Enrollments
              {enrollmentCount > 0 && (
                <Badge variant="secondary" className="h-4 sm:h-5 px-1 sm:px-1.5 text-xs">
                  {enrollmentCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs sm:text-sm">Activity</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs sm:text-sm">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab campaign={campaign} />
          </TabsContent>
          <TabsContent value="emails">
            <EmailsTab campaign={campaign} />
          </TabsContent>
          <TabsContent value="enrollments">
            <EnrollmentsTab campaignId={campaign.id} />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityTab campaignId={campaign.id} />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsTab campaign={campaign} />
          </TabsContent>
        </Tabs>
      </CampaignErrorBoundary>
    </div>
  );
}

function Header({ campaign }: { campaign: CampaignWithSearch }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4 sm:mb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{campaign.name}</h1>
        {campaign.search && (
          <p className="text-sm text-muted-foreground mt-1">
            Source:{" "}
            <Link
              href={`/searches/${campaign.search.id}`}
              className="hover:underline"
            >
              {campaign.search.name}
            </Link>
          </p>
        )}
      </div>
      <CampaignStatusBadge status={campaign.status} />
    </header>
  );
}
