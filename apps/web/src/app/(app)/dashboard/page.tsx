import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout";
import { PageSetup } from "./_components/page-setup";
import { CallsTodayCard } from "./_components/calls-today-card";
import { NewRepliesCard } from "./_components/new-replies-card";
import { StalledDealsCard } from "./_components/stalled-deals-card";
import { PipelineSnapshot } from "./_components/pipeline-snapshot";
import { DealsReadyCard } from "./_components/deals-ready-card";
import { AgentActivityTimeline } from "./_components/agent-activity";
import { ServicesStatusCard } from "./_components/services-status-card";
import { CampaignsCard } from "./_components/campaigns-card";
import { Classification } from "@/components/classification-badge";

async function getDashboardData() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Parallel fetches for all dashboard data
  const [
    emailDraftsResult,
    lowConfidenceResult,
    callsResult,
    repliesResult,
    stalledResult,
    dealPipelineResult,
    leadPipelineResult,
    dealsReadyResult,
    costarStatusResult,
    outlookStatusResult,
    claudeStatusResult,
    campaignsResult,
  ] = await Promise.all([
    // Pending email drafts
    supabase
      .from("email_drafts")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),

    // Low confidence classifications needing review
    supabase
      .from("synced_emails")
      .select("id", { count: "exact", head: true })
      .eq("direction", "inbound")
      .eq("needs_review", true),

    // Calls scheduled for today (from calls table)
    supabase
      .from("calls")
      .select(
        `
        id,
        scheduled_at,
        contact:contacts (
          name
        ),
        deal:deals (
          property:properties (
            address
          )
        )
      `
      )
      .eq("status", "scheduled")
      .gte("scheduled_at", today)
      .lt("scheduled_at", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
      .order("scheduled_at"),

    // New replies grouped by classification (simplified to 5 types)
    supabase
      .from("synced_emails")
      .select("classification")
      .eq("direction", "inbound")
      .gte("received_at", yesterday)
      .not("classification", "is", null),

    // Stalled deals from potential_ghosts view
    supabase
      .from("potential_ghosts")
      .select(
        `
        deal_id,
        display_id,
        lead_name,
        contact_name,
        last_response_at,
        follow_up_count
      `
      )
      .limit(5),

    // Pipeline counts using RPC functions (avoids row limits)
    supabase.rpc("get_deal_pipeline_counts"),
    supabase.rpc("get_lead_pipeline_counts"),

    // Deals ready to package (qualified but not packaged)
    supabase
      .from("deals")
      .select(
        `
        id,
        display_id,
        asking_price,
        cap_rate,
        noi,
        motivation,
        timeline,
        lead:leads (
          name
        ),
        property:properties (
          property_type,
          address
        )
      `
      )
      .eq("status", "qualified")
      .limit(5),

    // Services status - CoStar (most recent property created)
    supabase
      .from("properties")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),

    // Services status - Outlook sync
    supabase
      .from("email_sync_state")
      .select("last_sync_at")
      .limit(1)
      .single(),

    // Services status - Claude CLI (last search with payloads)
    supabase
      .from("searches")
      .select("updated_at")
      .not("payloads_json", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single(),

    // All campaigns
    supabase
      .from("campaigns")
      .select("id, name, status, total_enrolled, total_replied")
      .order("created_at", { ascending: false }),
  ]);

  // Process calls
  const calls =
    callsResult.data?.map((call: any) => ({
      id: call.id,
      time: new Date(call.scheduled_at).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
      contactName: call.contact?.name || "Unknown",
      propertyAddress: call.deal?.property?.address || "No property",
    })) || [];

  // Process replies by classification type (simplified to 5)
  const replyCounts: Record<string, number> = {};
  repliesResult.data?.forEach((email: { classification: string }) => {
    const type = email.classification || "other";
    replyCounts[type] = (replyCounts[type] || 0) + 1;
  });
  const replies = Object.entries(replyCounts).map(([type, count]) => ({
    type: type as Classification,
    count,
  }));

  // Process stalled deals from view
  const stalledDeals =
    stalledResult.data?.map((deal: any) => ({
      id: deal.deal_id,
      displayId: deal.display_id,
      companyName: deal.lead_name || "Unknown",
      daysSinceResponse: deal.last_response_at
        ? Math.floor(
            (Date.now() - new Date(deal.last_response_at).getTime()) /
              (24 * 60 * 60 * 1000)
          )
        : 0,
      followUpCount: deal.follow_up_count || 0,
      status: "stalled",
    })) || [];

  // Process deal pipeline counts from RPC
  const dealStatusMap: Record<string, number> = {};
  dealPipelineResult.data?.forEach((row: { status: string; count: number }) => {
    dealStatusMap[row.status] = row.count;
  });
  const dealPipelineStages = [
    { name: "New", count: dealStatusMap.new || 0, color: "bg-slate-500" },
    { name: "Gathering", count: dealStatusMap.gathering || 0, color: "bg-blue-500" },
    { name: "Qualified", count: dealStatusMap.qualified || 0, color: "bg-green-500" },
    { name: "Packaging", count: dealStatusMap.packaging || 0, color: "bg-purple-500" },
  ].filter(stage => stage.count > 0 || ["Gathering", "Qualified"].includes(stage.name));

  // Process lead pipeline counts from RPC
  const leadStatusMap: Record<string, number> = {};
  leadPipelineResult.data?.forEach((row: { status: string; count: number }) => {
    leadStatusMap[row.status] = row.count;
  });
  const leadPipelineStages = [
    { name: "New", count: leadStatusMap.new || 0, color: "bg-slate-400" },
    { name: "Contacted", count: leadStatusMap.contacted || 0, color: "bg-sky-500" },
    { name: "Replied", count: leadStatusMap.replied || 0, color: "bg-blue-500" },
    { name: "Engaged", count: leadStatusMap.engaged || 0, color: "bg-indigo-500" },
    { name: "Waiting", count: leadStatusMap.waiting || 0, color: "bg-amber-500" },
    { name: "Qualified", count: leadStatusMap.qualified || 0, color: "bg-green-500" },
    { name: "Nurture", count: leadStatusMap.nurture || 0, color: "bg-violet-400" },
  ].filter(stage => stage.count > 0 || ["New", "Contacted", "Qualified"].includes(stage.name));

  // Process deals ready to package
  const dealsReady =
    dealsReadyResult.data?.map((deal: any) => ({
      id: deal.id,
      displayId: deal.display_id,
      propertyType: deal.property?.property_type || "Unknown",
      address: deal.property?.address || "No address",
      companyName: deal.lead?.name || "Unknown",
      price: deal.asking_price
        ? `$${(deal.asking_price / 1000000).toFixed(1)}M`
        : "TBD",
      capRate: deal.cap_rate ? `${deal.cap_rate.toFixed(1)}%` : "TBD",
      noi: deal.noi ? `$${(deal.noi / 1000).toFixed(0)}K` : "TBD",
      motivation: deal.motivation || "Not stated",
      timeline: deal.timeline || "Not stated",
      matchingClients: [], // TODO: Match against searches criteria_json
    })) || [];

  // Agent activity (pg-boss handles execution, no tracking table)
  const agentActivities = [
    {
      name: "sourcing-agent",
      displayName: "Sourcing",
      runs: 0,
      description: "Generates CoStar queries",
    },
    {
      name: "process-replies",
      displayName: "Classifier",
      runs: 0,
      description: "Classifies email replies",
    },
    {
      name: "send-email",
      displayName: "Email Sender",
      runs: 0,
      description: "Sends queued emails",
    },
  ];

  // Build services status
  const services = [
    {
      name: "CoStar",
      description: "Property data extraction",
      lastActive: costarStatusResult.data?.created_at
        ? new Date(costarStatusResult.data.created_at)
        : null,
      icon: "costar" as const,
    },
    {
      name: "Outlook",
      description: "Email sync",
      lastActive: outlookStatusResult.data?.last_sync_at
        ? new Date(outlookStatusResult.data.last_sync_at)
        : null,
      icon: "outlook" as const,
    },
    {
      name: "Claude CLI",
      description: "AI agent execution",
      lastActive: claudeStatusResult.data?.updated_at
        ? new Date(claudeStatusResult.data.updated_at)
        : null,
      icon: "claude" as const,
    },
  ];

  // Process campaigns
  const campaigns =
    campaignsResult.data?.map((c: any) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      totalEnrolled: c.total_enrolled || 0,
      totalReplied: c.total_replied || 0,
    })) || [];

  return {
    emailDrafts: emailDraftsResult.count || 0,
    lowConfidence: lowConfidenceResult.count || 0,
    calls,
    replies,
    totalReplies: repliesResult.data?.length || 0,
    stalledDeals,
    dealPipelineStages,
    leadPipelineStages,
    dealsReady,
    agentActivities,
    services,
    campaigns,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <PageSetup>
      <PageContainer>
        {/* Top row: Action cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <CallsTodayCard calls={data.calls} />
          <NewRepliesCard replies={data.replies} total={data.totalReplies} />
          <StalledDealsCard deals={data.stalledDeals} />
        </div>

        {/* Pipeline snapshots */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <PipelineSnapshot title="Lead Pipeline" stages={data.leadPipelineStages} href="/leads" />
          <PipelineSnapshot title="Deal Pipeline" stages={data.dealPipelineStages} href="/pipeline" />
        </div>

        {/* Bottom row: Deals ready + Agent activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <DealsReadyCard deals={data.dealsReady} />
          <AgentActivityTimeline activities={data.agentActivities} />
        </div>

        {/* System row: Services + Campaigns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ServicesStatusCard services={data.services} />
          <CampaignsCard campaigns={data.campaigns} />
        </div>
      </PageContainer>
    </PageSetup>
  );
}
