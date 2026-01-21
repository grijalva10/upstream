import { createClient } from "@/lib/supabase/server";
import { MissionControl, type DashboardData } from "./_components/mission-control";

// Job schedule configuration
const JOB_SCHEDULES: Record<string, { interval: number; display: string } | { triggered: true }> = {
  "email-sync": { interval: 5 * 60 * 1000, display: "→ 5m" },
  "process-replies": { interval: 2 * 60 * 1000, display: "→ 2m" },
  "process-queue": { interval: 60 * 1000, display: "→ 1m" },
  "send-email": { triggered: true },
  "generate-queries": { triggered: true },
  "auto-follow-up": { interval: 24 * 60 * 60 * 1000, display: "→ tmrw" },
  "ghost-detection": { interval: 24 * 60 * 60 * 1000, display: "→ tmrw" },
  "reconcile-lead-status": { interval: 7 * 24 * 60 * 60 * 1000, display: "→ Sun" },
};

const JOB_DISPLAY_NAMES: Record<string, string> = {
  "email-sync": "email-sync",
  "process-replies": "process-replies",
  "process-queue": "process-queue",
  "send-email": "send-email",
  "generate-queries": "generate-queries",
  "auto-follow-up": "auto-follow-up",
  "ghost-detection": "ghost-detection",
  "reconcile-lead-status": "reconcile-status",
};

function getJobStatus(
  lastRun: Date | null,
  schedule: { interval: number } | { triggered: true },
  hasFailed: boolean
): "healthy" | "warning" | "error" | "idle" {
  if (hasFailed) return "error";
  if (!lastRun) return "idle";

  if ("triggered" in schedule) {
    return "idle";
  }

  const elapsed = Date.now() - lastRun.getTime();
  if (elapsed < schedule.interval * 2) return "healthy";
  if (elapsed < schedule.interval * 4) return "warning";
  return "error";
}

function getServiceStatus(
  lastActive: Date | null,
  thresholds: { healthy: number; warning: number }
): "healthy" | "warning" | "error" {
  if (!lastActive) return "error";
  const elapsed = Date.now() - lastActive.getTime();
  if (elapsed < thresholds.healthy) return "healthy";
  if (elapsed < thresholds.warning) return "warning";
  return "error";
}

async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  // Parallel fetches
  const [
    // Attention items
    draftsResult,
    hotRepliesResult,
    lowConfidenceResult,
    callsResult,
    stalledResult,
    // Pipeline
    leadPipelineResult,
    dealPipelineResult,
    // Campaigns
    campaignsResult,
    // Jobs
    jobsResult,
    // Searches
    searchesResult,
    searchesTotalResult,
    // Services
    costarResult,
    outlookResult,
    claudeResult,
    // Worker
    workerResult,
  ] = await Promise.all([
    // Pending drafts
    supabase
      .from("email_drafts")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),

    // Hot replies (tasks with incoming_email type that have hot classification)
    supabase
      .from("tasks")
      .select("id, object_id", { count: "exact" })
      .eq("type", "incoming_email")
      .eq("status", "pending"),

    // Low confidence needing review
    supabase
      .from("synced_emails")
      .select("id", { count: "exact", head: true })
      .eq("direction", "inbound")
      .eq("needs_review", true),

    // Calls today
    supabase
      .from("calls")
      .select("id", { count: "exact", head: true })
      .eq("status", "scheduled")
      .gte("scheduled_at", today)
      .lt("scheduled_at", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()),

    // Stalled deals
    supabase.from("potential_ghosts").select("deal_id", { count: "exact", head: true }),

    // Pipeline counts
    supabase.rpc("get_lead_pipeline_counts"),
    supabase.rpc("get_deal_pipeline_counts"),

    // Campaigns with hot count
    supabase
      .from("campaigns")
      .select("id, name, status, total_enrolled, total_replied")
      .order("created_at", { ascending: false }),

    // Jobs from pg-boss
    supabase.rpc("get_pgboss_jobs", { p_limit: 100 }),

    // Active searches
    supabase
      .from("searches")
      .select("id, name, status")
      .neq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(6),

    // Total searches count
    supabase
      .from("searches")
      .select("id", { count: "exact", head: true })
      .neq("status", "complete"),

    // CoStar last activity
    supabase
      .from("properties")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),

    // Outlook last sync
    supabase.from("email_sync_state").select("last_sync_at").limit(1).single(),

    // Claude last activity
    supabase
      .from("searches")
      .select("updated_at")
      .not("payloads_json", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single(),

    // Worker status
    supabase.from("worker_status").select("is_running, is_paused").eq("id", "main").single(),
  ]);

  // Get hot count from tasks - need to check synced_emails for classification
  let hotCount = 0;
  if (hotRepliesResult.data && hotRepliesResult.data.length > 0) {
    const threadIds = hotRepliesResult.data
      .filter((t: any) => t.object_id)
      .map((t: any) => t.object_id);

    if (threadIds.length > 0) {
      const { data: hotEmails } = await supabase
        .from("synced_emails")
        .select("id", { count: "exact", head: true })
        .in("outlook_conversation_id", threadIds)
        .eq("classification", "hot");
      hotCount = hotEmails ? 1 : 0; // Simplified - just check if any hot
    }
  }

  // Get property counts for searches
  const searchIds = searchesResult.data?.map((s: any) => s.id) || [];
  let searchPropertyCounts: Record<string, number> = {};
  if (searchIds.length > 0) {
    const { data: propCounts } = await supabase
      .from("search_properties")
      .select("search_id")
      .in("search_id", searchIds);

    if (propCounts) {
      propCounts.forEach((p: any) => {
        searchPropertyCounts[p.search_id] = (searchPropertyCounts[p.search_id] || 0) + 1;
      });
    }
  }

  // Get hot counts per campaign
  const campaignIds = campaignsResult.data?.map((c: any) => c.id) || [];
  let campaignHotCounts: Record<string, number> = {};
  if (campaignIds.length > 0) {
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("campaign_id, contact_id")
      .in("campaign_id", campaignIds);

    if (enrollments && enrollments.length > 0) {
      const contactIds = [...new Set(enrollments.map((e: any) => e.contact_id))];
      const { data: hotEmails } = await supabase
        .from("synced_emails")
        .select("contact_id")
        .in("contact_id", contactIds)
        .eq("classification", "hot");

      if (hotEmails) {
        const hotContactIds = new Set(hotEmails.map((e: any) => e.contact_id));
        enrollments.forEach((e: any) => {
          if (hotContactIds.has(e.contact_id)) {
            campaignHotCounts[e.campaign_id] = (campaignHotCounts[e.campaign_id] || 0) + 1;
          }
        });
      }
    }
  }

  // Process jobs data
  const jobsByName: Record<string, any[]> = {};
  (jobsResult.data || []).forEach((job: any) => {
    if (!jobsByName[job.name]) jobsByName[job.name] = [];
    jobsByName[job.name].push(job);
  });

  const jobs: DashboardData["jobs"] = Object.keys(JOB_SCHEDULES).map((jobName) => {
    const jobRuns = jobsByName[jobName] || [];
    const completedRuns = jobRuns
      .filter((j) => j.state === "completed")
      .sort((a, b) => new Date(b.completed_on).getTime() - new Date(a.completed_on).getTime());

    const failedRuns = jobRuns.filter((j) => j.state === "failed");
    const lastCompleted = completedRuns[0];
    const schedule = JOB_SCHEDULES[jobName];

    return {
      name: jobName,
      displayName: JOB_DISPLAY_NAMES[jobName] || jobName,
      lastRun: lastCompleted ? new Date(lastCompleted.completed_on) : null,
      nextRun: "triggered" in schedule ? "triggered" : schedule.display,
      status: getJobStatus(
        lastCompleted ? new Date(lastCompleted.completed_on) : null,
        schedule,
        failedRuns.length > 0
      ),
      recentRuns: completedRuns.slice(0, 3).map((r) => ({
        completedAt: new Date(r.completed_on),
        output: r.output ? JSON.stringify(r.output).slice(0, 50) : null,
      })),
    };
  });

  // Build attention items
  const attention: DashboardData["attention"] = [];

  if ((draftsResult.count || 0) > 0) {
    attention.push({
      label: "drafts pending",
      count: draftsResult.count || 0,
      href: "/inbox?type=email",
      urgent: true,
    });
  }

  if (hotCount > 0) {
    attention.push({
      label: "hot reply",
      count: hotCount,
      href: "/inbox?type=email",
      urgent: true,
    });
  }

  if ((lowConfidenceResult.count || 0) > 0) {
    attention.push({
      label: "low-confidence",
      count: lowConfidenceResult.count || 0,
      href: "/inbox?type=email",
      urgent: false,
    });
  }

  if ((callsResult.count || 0) > 0) {
    attention.push({
      label: "calls today",
      count: callsResult.count || 0,
      href: "/calls",
      urgent: false,
    });
  }

  if ((stalledResult.count || 0) > 0) {
    attention.push({
      label: "stalled deals",
      count: stalledResult.count || 0,
      href: "/pipeline?filter=stalled",
      urgent: false,
    });
  }

  // Build lead pipeline stages
  const leadStatusMap: Record<string, number> = {};
  (leadPipelineResult.data || []).forEach((row: { status: string; count: number }) => {
    leadStatusMap[row.status] = row.count;
  });

  const leadStages: DashboardData["leadStages"] = [
    { name: "New", abbrev: "new", count: leadStatusMap.new || 0 },
    { name: "Contacted", abbrev: "cnt", count: leadStatusMap.contacted || 0 },
    { name: "Replied", abbrev: "rpl", count: leadStatusMap.replied || 0 },
    { name: "Engaged", abbrev: "eng", count: leadStatusMap.engaged || 0 },
    { name: "Waiting", abbrev: "wt", count: leadStatusMap.waiting || 0 },
    { name: "Qualified", abbrev: "qual", count: leadStatusMap.qualified || 0 },
    { name: "Handed Off", abbrev: "hoff", count: leadStatusMap.handed_off || 0 },
  ];

  // Build deal pipeline stages
  const dealStatusMap: Record<string, number> = {};
  (dealPipelineResult.data || []).forEach((row: { status: string; count: number }) => {
    dealStatusMap[row.status] = row.count;
  });

  const dealStages: DashboardData["dealStages"] = [
    { name: "New", abbrev: "new", count: dealStatusMap.new || 0 },
    { name: "Gathering", abbrev: "gath", count: dealStatusMap.gathering || 0 },
    { name: "Qualified", abbrev: "qual", count: dealStatusMap.qualified || 0 },
    { name: "Packaging", abbrev: "pkg", count: dealStatusMap.packaging || 0 },
    { name: "Handed Off", abbrev: "hoff", count: dealStatusMap.handed_off || 0 },
  ];

  // Build campaigns
  const campaigns: DashboardData["campaigns"] = (campaignsResult.data || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    totalEnrolled: c.total_enrolled || 0,
    totalReplied: c.total_replied || 0,
    hotCount: campaignHotCounts[c.id] || 0,
  }));

  // Build searches
  const searches: DashboardData["searches"] = (searchesResult.data || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    propertyCount: searchPropertyCounts[s.id] || null,
  }));

  // Build services
  const costarLastActive = costarResult.data?.created_at
    ? new Date(costarResult.data.created_at)
    : null;
  const outlookLastActive = outlookResult.data?.last_sync_at
    ? new Date(outlookResult.data.last_sync_at)
    : null;
  const claudeLastActive = claudeResult.data?.updated_at
    ? new Date(claudeResult.data.updated_at)
    : null;

  const services: DashboardData["services"] = [
    {
      name: "CoStar",
      lastActive: costarLastActive,
      status: getServiceStatus(costarLastActive, {
        healthy: 24 * 60 * 60 * 1000,
        warning: 7 * 24 * 60 * 60 * 1000,
      }),
      detail: `${leadStatusMap.new || 0} properties`,
    },
    {
      name: "Outlook",
      lastActive: outlookLastActive,
      status: getServiceStatus(outlookLastActive, {
        healthy: 10 * 60 * 1000,
        warning: 30 * 60 * 1000,
      }),
      detail: outlookLastActive
        ? `last sync: ${outlookLastActive.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
        : "never synced",
    },
    {
      name: "Claude CLI",
      lastActive: claudeLastActive,
      status: getServiceStatus(claudeLastActive, {
        healthy: 7 * 24 * 60 * 60 * 1000,
        warning: 30 * 24 * 60 * 60 * 1000,
      }),
      detail: "sourcing agent",
    },
  ];

  return {
    attention,
    leadStages,
    dealStages,
    campaigns,
    jobs,
    searches,
    searchesTotal: searchesTotalResult.count || 0,
    services,
    worker: {
      isRunning: workerResult.data?.is_running ?? false,
      isPaused: workerResult.data?.is_paused ?? false,
    },
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return <MissionControl data={data} />;
}
