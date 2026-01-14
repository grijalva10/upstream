import { createClient } from "@/lib/supabase/server";
import { ApprovalsCard } from "./_components/approvals-card";
import { CallsTodayCard } from "./_components/calls-today-card";
import { NewRepliesCard } from "./_components/new-replies-card";
import { StalledDealsCard } from "./_components/stalled-deals-card";
import { PipelineSnapshot } from "./_components/pipeline-snapshot";
import { DealsReadyCard } from "./_components/deals-ready-card";
import { AgentActivityTimeline } from "./_components/agent-activity";
import { ClassificationType } from "@/components/classification-badge";

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
      .lt("classification_confidence", 0.7)
      .eq("needs_human_review", true),

    // Calls scheduled for today
    supabase
      .from("tasks")
      .select(
        `
        id,
        due_date,
        contacts (
          name
        ),
        properties (
          address
        )
      `
      )
      .eq("type", "call_reminder")
      .eq("status", "pending")
      .gte("due_date", today)
      .lt("due_date", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
      .order("due_date"),

    // New replies grouped by classification
    supabase
      .from("synced_emails")
      .select("classification")
      .eq("direction", "inbound")
      .gte("received_at", yesterday)
      .not("classification", "is", null),

    // Stalled deals (no activity in 5+ days)
    supabase
      .from("qualification_data")
      .select(
        `
        id,
        companies (
          name
        ),
        last_response_at,
        status
      `
      )
      .lt(
        "last_response_at",
        new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      )
      .is("qualified_at", null)
      .limit(5),

    // Pipeline counts by status
    supabase.from("companies").select("status"),

    // Deals ready to package
    supabase
      .from("qualification_data")
      .select(
        `
        id,
        asking_price,
        cap_rate,
        noi,
        motivation,
        timeline,
        companies (
          name
        ),
        properties (
          property_type,
          address
        )
      `
      )
      .not("qualified_at", "is", null)
      .is("packaged_at", null)
      .limit(5),

    // Agent activity in last 24h
    supabase
      .from("agent_executions")
      .select("agent_name")
      .gte("created_at", yesterday),
  ]);

  // Process calls
  const calls =
    callsResult.data?.map((task: any) => ({
      id: task.id,
      time: new Date(task.due_date).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
      contactName: task.contacts?.name || "Unknown",
      propertyAddress: task.properties?.address || "No property",
    })) || [];

  // Process replies by classification type
  const replyCounts: Record<string, number> = {};
  repliesResult.data?.forEach((email: { classification: string }) => {
    const type = email.classification || "needs_review";
    replyCounts[type] = (replyCounts[type] || 0) + 1;
  });
  const replies = Object.entries(replyCounts).map(([type, count]) => ({
    type: type as ClassificationType,
    count,
  }));

  // Process stalled deals
  const stalledDeals =
    stalledResult.data?.map((deal: any) => ({
      id: deal.id,
      companyName: deal.companies?.name || "Unknown",
      daysSinceResponse: Math.floor(
        (Date.now() - new Date(deal.last_response_at).getTime()) /
          (24 * 60 * 60 * 1000)
      ),
      status: deal.status || "in_progress",
    })) || [];

  // Process pipeline counts
  const statusCounts: Record<string, number> = {
    new: 0,
    contacted: 0,
    engaged: 0,
    qualified: 0,
    handed_off: 0,
  };
  pipelineResult.data?.forEach((company: { status: string }) => {
    if (company.status in statusCounts) {
      statusCounts[company.status]++;
    }
  });
  const pipelineStages = [
    { name: "New", count: statusCounts.new, color: "bg-slate-500" },
    { name: "Contacted", count: statusCounts.contacted, color: "bg-blue-500" },
    { name: "Engaged", count: statusCounts.engaged, color: "bg-amber-500" },
    { name: "Qualified", count: statusCounts.qualified, color: "bg-green-500" },
    { name: "Handed Off", count: statusCounts.handed_off, color: "bg-purple-500" },
  ];

  // Process deals ready
  const dealsReady =
    dealsReadyResult.data?.map((deal: any) => ({
      id: deal.id,
      propertyType: deal.properties?.property_type || "Unknown",
      address: deal.properties?.address || "No address",
      companyName: deal.companies?.name || "Unknown",
      price: deal.asking_price
        ? `$${(deal.asking_price / 1000000).toFixed(1)}M`
        : "TBD",
      capRate: deal.cap_rate
        ? `${deal.cap_rate.toFixed(1)}%`
        : "TBD",
      noi: deal.noi
        ? `$${(deal.noi / 1000).toFixed(0)}K`
        : "TBD",
      motivation: deal.motivation || "Not stated",
      timeline: deal.timeline || "Not stated",
      matchingClients: [], // TODO: Match against client_criteria
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
      name: "response-classifier",
      displayName: "Classifier",
      runs: agentCounts["response-classifier"] || 0,
      description: `${agentCounts["response-classifier"] || 0} classified`,
    },
    {
      name: "qualify-agent",
      displayName: "Qualify",
      runs: agentCounts["qualify-agent"] || 0,
      description: `${agentCounts["qualify-agent"] || 0} follow-ups`,
    },
    {
      name: "schedule-agent",
      displayName: "Schedule",
      runs: agentCounts["schedule-agent"] || 0,
      description: `${agentCounts["schedule-agent"] || 0} scheduled`,
    },
    {
      name: "deal-packager",
      displayName: "Packager",
      runs: agentCounts["deal-packager"] || 0,
      description: `${agentCounts["deal-packager"] || 0} packaged`,
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

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Command Center</h1>
        <p className="text-sm text-muted-foreground">{today}</p>
      </div>

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
    </div>
  );
}
