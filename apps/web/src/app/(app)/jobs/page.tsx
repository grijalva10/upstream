import { createClient } from "@/lib/supabase/server";
import { JobsDataTable } from "./_components/jobs-data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QueueStats {
  pending_count: number;
  scheduled_count: number;
  processing_count: number;
  sent_today: number;
  failed_today: number;
  hourly_count: number;
  hourly_limit: number;
  daily_count: number;
  daily_limit: number;
}

interface WorkerStatus {
  is_running: boolean;
  is_paused: boolean;
  last_heartbeat: string | null;
  jobs_processed: number;
  jobs_failed: number;
  started_at: string | null;
}

async function getJobsData() {
  const supabase = await createClient();

  // Fetch queue stats
  const { data: statsData } = await supabase.rpc("get_queue_stats");
  const stats: QueueStats = statsData?.[0] || {
    pending_count: 0,
    scheduled_count: 0,
    processing_count: 0,
    sent_today: 0,
    failed_today: 0,
    hourly_count: 0,
    hourly_limit: 1000,
    daily_count: 0,
    daily_limit: 10000,
  };

  // Fetch worker status
  const { data: workerData } = await supabase
    .from("worker_status")
    .select("*")
    .eq("id", "main")
    .single();

  const worker: WorkerStatus = workerData || {
    is_running: false,
    is_paused: false,
    last_heartbeat: null,
    jobs_processed: 0,
    jobs_failed: 0,
    started_at: null,
  };

  // Fetch recent jobs from email_queue
  const { data: jobs } = await supabase
    .from("email_queue")
    .select(
      `
      id,
      job_type,
      source,
      status,
      priority,
      to_email,
      subject,
      attempts,
      max_attempts,
      last_error,
      created_at,
      scheduled_for,
      sent_at,
      sequence_id
    `
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return {
    stats,
    worker,
    jobs: jobs || [],
  };
}

function StatCard({
  title,
  value,
  subtitle,
  variant = "default",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const variantStyles = {
    default: "text-foreground",
    success: "text-green-600",
    warning: "text-amber-600",
    danger: "text-red-600",
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${variantStyles[variant]}`}>
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default async function JobsPage() {
  const { stats, worker, jobs } = await getJobsData();

  // Calculate worker status
  const lastHeartbeat = worker.last_heartbeat
    ? new Date(worker.last_heartbeat)
    : null;
  const isAlive =
    lastHeartbeat && Date.now() - lastHeartbeat.getTime() < 60000;
  const workerStatus = worker.is_paused
    ? "Paused"
    : isAlive
    ? "Running"
    : "Stopped";
  const workerVariant = worker.is_paused
    ? "warning"
    : isAlive
    ? "success"
    : "danger";

  // Calculate rate usage
  const hourlyUsage = Math.round(
    (stats.hourly_count / stats.hourly_limit) * 100
  );
  const dailyUsage = Math.round((stats.daily_count / stats.daily_limit) * 100);
  const rateVariant =
    hourlyUsage > 90 || dailyUsage > 90
      ? "danger"
      : hourlyUsage > 70 || dailyUsage > 70
      ? "warning"
      : "default";

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Jobs</h1>
        <p className="text-sm text-muted-foreground">
          Monitor email queue and background jobs
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard
          title="Worker"
          value={workerStatus}
          subtitle={
            lastHeartbeat
              ? `Last seen ${Math.round((Date.now() - lastHeartbeat.getTime()) / 1000)}s ago`
              : "Never started"
          }
          variant={workerVariant as "default" | "success" | "warning" | "danger"}
        />
        <StatCard
          title="Pending"
          value={stats.pending_count + stats.scheduled_count}
          subtitle="In queue"
        />
        <StatCard
          title="Active"
          value={stats.processing_count}
          subtitle="Processing now"
        />
        <StatCard
          title="Sent Today"
          value={stats.sent_today}
          variant="success"
        />
        <StatCard
          title="Failed Today"
          value={stats.failed_today}
          variant={stats.failed_today > 0 ? "danger" : "default"}
        />
        <StatCard
          title="Rate"
          value={`${stats.hourly_count}/${stats.hourly_limit}`}
          subtitle={`Daily: ${stats.daily_count}/${stats.daily_limit}`}
          variant={rateVariant as "default" | "success" | "warning" | "danger"}
        />
      </div>

      {/* Jobs table */}
      <Card>
        <CardHeader>
          <CardTitle>Email Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <JobsDataTable data={jobs} />
        </CardContent>
      </Card>
    </div>
  );
}
