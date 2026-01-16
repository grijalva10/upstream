import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Send, Mail, MessageSquare, ExternalLink } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { OverviewTab } from "./_components/overview-tab";
import { EmailsTab } from "./_components/emails-tab";
import { EnrollmentsTab } from "./_components/enrollments-tab";
import { ActivityTab } from "./_components/activity-tab";
import { SettingsTab } from "./_components/settings-tab";
import { CampaignErrorBoundary } from "./_components/error-boundary";
import { CampaignActions } from "./_components/campaign-actions";
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

  const metrics = {
    enrolled: campaign.total_enrolled ?? 0,
    sent: campaign.total_sent ?? 0,
    opened: campaign.total_opened ?? 0,
    replied: campaign.total_replied ?? 0,
  };

  return (
    <div className="min-h-screen">
      {/* Sticky top bar */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link
            href="/campaigns"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Campaigns
          </Link>

          {metrics.enrolled > 0 && (
            <div className="hidden sm:flex items-center gap-6 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{metrics.enrolled.toLocaleString()}</span>
                <span>enrolled</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Send className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{metrics.sent.toLocaleString()}</span>
                <span>sent</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{metrics.opened.toLocaleString()}</span>
                <span>opened</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{metrics.replied.toLocaleString()}</span>
                <span>replied</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <CampaignErrorBoundary>
        <div className="px-4 sm:px-6 py-6 max-w-5xl space-y-6">
          {/* Header */}
          <Header campaign={campaign} enrollmentCount={enrollmentCount} />

          {/* Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="h-auto p-1 bg-muted/50">
              <TabsTrigger
                value="overview"
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="emails"
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2"
              >
                Emails
              </TabsTrigger>
              <TabsTrigger
                value="enrollments"
                className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2"
              >
                Enrollments
                {enrollmentCount > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs font-normal">
                    {enrollmentCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2"
              >
                Activity
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2"
              >
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <OverviewTab campaign={campaign} />
            </TabsContent>
            <TabsContent value="emails" className="mt-6">
              <EmailsTab campaign={campaign} />
            </TabsContent>
            <TabsContent value="enrollments" className="mt-6">
              <EnrollmentsTab campaignId={campaign.id} />
            </TabsContent>
            <TabsContent value="activity" className="mt-6">
              <ActivityTab campaignId={campaign.id} />
            </TabsContent>
            <TabsContent value="settings" className="mt-6">
              <SettingsTab campaign={campaign} />
            </TabsContent>
          </Tabs>
        </div>
      </CampaignErrorBoundary>
    </div>
  );
}

function Header({ campaign, enrollmentCount }: { campaign: CampaignWithSearch; enrollmentCount: number }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{campaign.name}</h1>
          <CampaignStatusBadge status={campaign.status} />
        </div>
        {campaign.search && (
          <p className="text-sm text-muted-foreground">
            From search:{" "}
            <Link
              href={`/searches/${campaign.search.id}`}
              className="inline-flex items-center gap-1 text-foreground hover:underline"
            >
              {campaign.search.name}
              <ExternalLink className="h-3 w-3" />
            </Link>
          </p>
        )}
      </div>
      <CampaignActions
        campaignId={campaign.id}
        status={campaign.status}
        enrollmentCount={enrollmentCount}
      />
    </header>
  );
}
