import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  Mail,
  Send,
  Inbox,
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
} from "lucide-react";
import { OrchestratorControls } from "./_components/orchestrator-controls";

interface OrchestratorStatus {
  is_running: boolean;
  started_at: string | null;
  last_heartbeat: string | null;
  hostname: string | null;
  pid: number | null;
  loops_enabled: { send?: boolean; response?: boolean } | null;
  config: { dry_run?: boolean } | null;
}

interface LoopStatus {
  name: string;
  lastRun: Date | null;
  isHealthy: boolean;
  runsToday: number;
}

interface AgentExecution {
  id: string;
  agent_name: string;
  status: string;
  created_at: string;
  duration_ms: number | null;
  error_message: string | null;
}

async function getOrchestratorData() {
  const supabase = await createClient();
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  const [
    orchestratorStatusResult,
    recentExecutionsResult,
    todayExecutionsResult,
    emailsSentTodayResult,
    emailsClassifiedTodayResult,
    syncStateResult,
    errorsResult,
    pendingDraftsResult,
  ] = await Promise.all([
    // Orchestrator running status
    supabase
      .from("orchestrator_status")
      .select("*")
      .eq("id", "main")
      .single(),

    // Recent agent executions (last hour)
    supabase
      .from("agent_executions")
      .select("id, agent_name, status, created_at, duration_ms, error_message")
      .gte("created_at", oneHourAgo)
      .order("created_at", { ascending: false })
      .limit(20),

    // Today's execution counts by agent
    supabase
      .from("agent_executions")
      .select("agent_name, status")
      .gte("created_at", today),

    // Emails sent today
    supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("type", "email_sent")
      .gte("created_at", today),

    // Emails classified today
    supabase
      .from("synced_emails")
      .select("id", { count: "exact", head: true })
      .not("classification", "is", null)
      .gte("classified_at", today),

    // Email sync state
    supabase
      .from("email_sync_state")
      .select("last_sync_at")
      .single(),

    // Recent errors
    supabase
      .from("agent_executions")
      .select("id, agent_name, error_message, created_at")
      .eq("status", "failed")
      .gte("created_at", today)
      .order("created_at", { ascending: false })
      .limit(5),

    // Pending email drafts
    supabase
      .from("email_drafts")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  // Calculate loop statuses based on recent executions
  const recentExecs = recentExecutionsResult.data || [];
  const todayExecs = todayExecutionsResult.data || [];

  // Group today's executions by agent
  const agentStats: Record<string, { total: number; failed: number }> = {};
  todayExecs.forEach((exec) => {
    if (!agentStats[exec.agent_name]) {
      agentStats[exec.agent_name] = { total: 0, failed: 0 };
    }
    agentStats[exec.agent_name].total++;
    if (exec.status === "failed") {
      agentStats[exec.agent_name].failed++;
    }
  });

  // Determine send loop health (drip-campaign-exec agent)
  const sendLoopExecs = recentExecs.filter(
    (e) => e.agent_name === "drip-campaign-exec"
  );
  const lastSendRun = sendLoopExecs[0]?.created_at
    ? new Date(sendLoopExecs[0].created_at)
    : null;

  // Determine response loop health (response-classifier agent)
  const responseLoopExecs = recentExecs.filter(
    (e) => e.agent_name === "response-classifier"
  );
  const lastResponseRun = responseLoopExecs[0]?.created_at
    ? new Date(responseLoopExecs[0].created_at)
    : null;

  // Check sync state
  const lastSyncAt = syncStateResult.data?.last_sync_at
    ? new Date(syncStateResult.data.last_sync_at)
    : null;
  const syncIsHealthy = lastSyncAt
    ? now.getTime() - lastSyncAt.getTime() < 10 * 60 * 1000 // 10 min threshold
    : false;

  // Determine orchestrator running status
  const orchestratorData = orchestratorStatusResult.data as OrchestratorStatus | null;
  const lastHeartbeat = orchestratorData?.last_heartbeat
    ? new Date(orchestratorData.last_heartbeat)
    : null;
  // Consider running if heartbeat within last 60 seconds
  const isActuallyRunning =
    orchestratorData?.is_running &&
    lastHeartbeat &&
    now.getTime() - lastHeartbeat.getTime() < 60 * 1000;

  return {
    orchestrator: {
      isRunning: !!isActuallyRunning,
      markedAsRunning: orchestratorData?.is_running || false,
      startedAt: orchestratorData?.started_at
        ? new Date(orchestratorData.started_at)
        : null,
      lastHeartbeat,
      hostname: orchestratorData?.hostname || null,
      pid: orchestratorData?.pid || null,
      loopsEnabled: orchestratorData?.loops_enabled || null,
      dryRun: orchestratorData?.config?.dry_run || false,
    },
    loops: {
      send: {
        name: "Send Loop",
        lastRun: lastSendRun,
        isHealthy:
          lastSendRun &&
          now.getTime() - lastSendRun.getTime() < 5 * 60 * 1000,
        runsToday: agentStats["drip-campaign-exec"]?.total || 0,
      },
      response: {
        name: "Response Loop",
        lastRun: lastResponseRun,
        isHealthy:
          lastResponseRun &&
          now.getTime() - lastResponseRun.getTime() < 10 * 60 * 1000,
        runsToday: agentStats["response-classifier"]?.total || 0,
      },
    },
    sync: {
      lastSyncAt,
      isHealthy: syncIsHealthy,
    },
    stats: {
      emailsSentToday: emailsSentTodayResult.count || 0,
      emailsClassifiedToday: emailsClassifiedTodayResult.count || 0,
      pendingDrafts: pendingDraftsResult.count || 0,
      errorsToday: errorsResult.data?.length || 0,
    },
    recentExecutions: recentExecs as AgentExecution[],
    recentErrors: errorsResult.data || [],
    agentStats,
  };
}

function formatTimeAgo(date: Date | null): string {
  if (!date) return "Never";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function StatusBadge({ isHealthy }: { isHealthy: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
        isHealthy
          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      }`}
    >
      {isHealthy ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <AlertCircle className="h-3 w-3" />
      )}
      {isHealthy ? "Healthy" : "Stale"}
    </span>
  );
}

export default async function OrchestratorPage() {
  const data = await getOrchestratorData();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Orchestrator Health</h1>
        <p className="text-sm text-muted-foreground">
          Monitor the status of background loops and agent executions
        </p>
      </div>

      {/* Main Status Banner with Controls */}
      <OrchestratorControls
        isRunning={data.orchestrator.isRunning}
        lastHeartbeat={data.orchestrator.lastHeartbeat}
        hostname={data.orchestrator.hostname}
        pid={data.orchestrator.pid}
        startedAt={data.orchestrator.startedAt}
        loopsEnabled={data.orchestrator.loopsEnabled}
        dryRun={data.orchestrator.dryRun}
      />

      {/* Loop Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Send Loop */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Send className="h-4 w-4" />
              Send Loop
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <StatusBadge isHealthy={!!data.loops.send.isHealthy} />
              <span className="text-xs text-muted-foreground">
                {formatTimeAgo(data.loops.send.lastRun)}
              </span>
            </div>
            <p className="text-2xl font-bold">{data.loops.send.runsToday}</p>
            <p className="text-xs text-muted-foreground">runs today</p>
          </CardContent>
        </Card>

        {/* Response Loop */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              Response Loop
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <StatusBadge isHealthy={!!data.loops.response.isHealthy} />
              <span className="text-xs text-muted-foreground">
                {formatTimeAgo(data.loops.response.lastRun)}
              </span>
            </div>
            <p className="text-2xl font-bold">{data.loops.response.runsToday}</p>
            <p className="text-xs text-muted-foreground">runs today</p>
          </CardContent>
        </Card>

        {/* Email Sync */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <StatusBadge isHealthy={data.sync.isHealthy} />
              <span className="text-xs text-muted-foreground">
                {formatTimeAgo(data.sync.lastSyncAt)}
              </span>
            </div>
            <p className="text-2xl font-bold">{data.stats.emailsClassifiedToday}</p>
            <p className="text-xs text-muted-foreground">classified today</p>
          </CardContent>
        </Card>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Emails Sent</span>
            </div>
            <p className="text-2xl font-bold">{data.stats.emailsSentToday}</p>
            <p className="text-xs text-muted-foreground">today</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Pending Drafts</span>
            </div>
            <p className="text-2xl font-bold">{data.stats.pendingDrafts}</p>
            <p className="text-xs text-muted-foreground">awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Classified</span>
            </div>
            <p className="text-2xl font-bold">{data.stats.emailsClassifiedToday}</p>
            <p className="text-xs text-muted-foreground">today</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Errors</span>
            </div>
            <p className="text-2xl font-bold">{data.stats.errorsToday}</p>
            <p className="text-xs text-muted-foreground">today</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Executions and Errors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Executions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Executions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recentExecutions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No recent executions
                </p>
              ) : (
                data.recentExecutions.slice(0, 10).map((exec) => (
                  <div
                    key={exec.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          exec.status === "completed"
                            ? "bg-green-500"
                            : exec.status === "failed"
                            ? "bg-red-500"
                            : "bg-yellow-500"
                        }`}
                      />
                      <span className="text-sm font-medium">
                        {exec.agent_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      {exec.duration_ms && (
                        <span className="text-xs text-muted-foreground">
                          {(exec.duration_ms / 1000).toFixed(1)}s
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(new Date(exec.created_at))}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Errors */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Recent Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recentErrors.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No errors today
                </p>
              ) : (
                data.recentErrors.map((error: any) => (
                  <div
                    key={error.id}
                    className="py-2 border-b last:border-0"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">
                        {error.agent_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(new Date(error.created_at))}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {error.error_message || "Unknown error"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Stats */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Agent Performance Today</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Object.entries(data.agentStats).map(([agent, stats]) => (
              <div key={agent} className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-xs font-medium truncate">{agent}</p>
                <p className="text-xl font-bold">{stats.total}</p>
                {stats.failed > 0 && (
                  <p className="text-xs text-red-500">{stats.failed} failed</p>
                )}
              </div>
            ))}
            {Object.keys(data.agentStats).length === 0 && (
              <p className="text-sm text-muted-foreground col-span-full text-center">
                No agent activity today
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
