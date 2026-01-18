import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout";
import { PageSetup } from "./_components/page-setup";
import { ApprovalsCard } from "./_components/approvals-card";
import { CallsTodayCard } from "./_components/calls-today-card";
import { NewRepliesCard } from "./_components/new-replies-card";
import { StalledDealsCard } from "./_components/stalled-deals-card";
import { PipelineSnapshot } from "./_components/pipeline-snapshot";
import { DealsReadyCard } from "./_components/deals-ready-card";
import { AgentActivityTimeline } from "./_components/agent-activity";
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
    pipelineResult,
    dealsReadyResult,
    agentActivityResult,
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
        company_name,
        contact_name,
        last_response_at,
        follow_up_count
      `
      )
      .limit(5),

    // Pipeline counts from deals table
    supabase.from("deals").select("status").not("status", "in", "(handed_off,lost)"),

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
        company:companies (
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

    // Agent activity in last 24h
    supabase
      .from("agent_executions")
      .select("agent_name")
      .gte("created_at", yesterday),
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
      companyName: deal.company_name || "Unknown",
      daysSinceResponse: deal.last_response_at
        ? Math.floor(
            (Date.now() - new Date(deal.last_response_at).getTime()) /
              (24 * 60 * 60 * 1000)
          )
        : 0,
      followUpCount: deal.follow_up_count || 0,
    })) || [];

  // Process pipeline counts by status
  const statusCounts: Record<string, number> = {
    new: 0,
    engaging: 0,
    qualifying: 0,
    qualified: 0,
    packaged: 0,
  };
  pipelineResult.data?.forEach((deal: { status: string }) => {
    if (deal.status in statusCounts) {
      statusCounts[deal.status]++;
    }
  });
  const pipelineStages = [
    { name: "New", count: statusCounts.new, color: "bg-slate-500" },
    { name: "Engaging", count: statusCounts.engaging, color: "bg-blue-500" },
    { name: "Qualifying", count: statusCounts.qualifying, color: "bg-amber-500" },
    { name: "Qualified", count: statusCounts.qualified, color: "bg-green-500" },
    { name: "Packaged", count: statusCounts.packaged, color: "bg-purple-500" },
  ];

  // Process deals ready to package
  const dealsReady =
    dealsReadyResult.data?.map((deal: any) => ({
      id: deal.id,
      displayId: deal.display_id,
      propertyType: deal.property?.property_type || "Unknown",
      address: deal.property?.address || "No address",
      companyName: deal.company?.name || "Unknown",
      price: deal.asking_price
        ? `$${(deal.asking_price / 1000000).toFixed(1)}M`
        : "TBD",
      capRate: deal.cap_rate ? `${deal.cap_rate.toFixed(1)}%` : "TBD",
      noi: deal.noi ? `$${(deal.noi / 1000).toFixed(0)}K` : "TBD",
      motivation: deal.motivation || "Not stated",
      timeline: deal.timeline || "Not stated",
      matchingClients: [], // TODO: Match against searches criteria_json
    })) || [];

  // Process agent activity
  const agentCounts: Record<string, number> = {};
  agentActivityResult.data?.forEach((exec: { agent_name: string }) => {
    agentCounts[exec.agent_name] = (agentCounts[exec.agent_name] || 0) + 1;
  });
  const agentActivities = [
    {
      name: "sourcing-agent",
      displayName: "Sourcing",
      runs: agentCounts["sourcing-agent"] || 0,
      description: `${agentCounts["sourcing-agent"] || 0} runs`,
    },
    {
      name: "drip-campaign-exec",
      displayName: "Drip Exec",
      runs: agentCounts["drip-campaign-exec"] || 0,
      description: `${agentCounts["drip-campaign-exec"] || 0} emails queued`,
    },
    {
      name: "process-replies",
      displayName: "Classifier",
      runs: agentCounts["process-replies"] || 0,
      description: `${agentCounts["process-replies"] || 0} classified`,
    },
  ];

  return {
    emailDrafts: emailDraftsResult.count || 0,
    lowConfidence: lowConfidenceResult.count || 0,
    calls,
    replies,
    totalReplies: repliesResult.data?.length || 0,
    stalledDeals,
    pipelineStages,
    dealsReady,
    agentActivities,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <PageSetup>
      <PageContainer>
        {/* Top row: Action cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <ApprovalsCard
            emailDrafts={data.emailDrafts}
            lowConfidence={data.lowConfidence}
          />
          <CallsTodayCard calls={data.calls} />
          <NewRepliesCard replies={data.replies} total={data.totalReplies} />
          <StalledDealsCard deals={data.stalledDeals} />
        </div>

        {/* Pipeline snapshot */}
        <div className="mb-6">
          <PipelineSnapshot stages={data.pipelineStages} />
        </div>

        {/* Bottom row: Deals ready + Agent activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DealsReadyCard deals={data.dealsReady} />
          <AgentActivityTimeline activities={data.agentActivities} />
        </div>
      </PageContainer>
    </PageSetup>
  );
}
