"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Play,
  Pause,
  RefreshCw,
  Save,
  AlertCircle,
  Mail,
  MailX,
} from "lucide-react";

interface WorkerSettings {
  "worker.rate_limit_hourly": number;
  "worker.rate_limit_daily": number;
  "worker.default_timezone": string;
  "worker.interval_email_sync": number;
  "worker.interval_check_replies": number;
  "worker.interval_queue_process": number;
  "worker.dry_run": boolean;
  "worker.debug": boolean;
  "worker.paused": boolean;
}

interface WorkerStatus {
  is_running: boolean;
  is_paused: boolean;
  last_heartbeat: string | null;
  jobs_processed: number;
  jobs_failed: number;
  started_at: string | null;
  pid: number | null;
  hostname: string | null;
}

interface RateStatus {
  can_send: boolean;
  hourly_count: number;
  daily_count: number;
  hourly_remaining: number;
  daily_remaining: number;
  reason: string;
}

const TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Phoenix",
  "Pacific/Honolulu",
  "UTC",
];

export default function WorkerSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<WorkerSettings | null>(null);
  const [worker, setWorker] = useState<WorkerStatus | null>(null);
  const [rateStatus, setRateStatus] = useState<RateStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/settings/worker");
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setSettings(data.settings as WorkerSettings);
        setWorker(data.worker);
        setRateStatus(data.rateStatus);
        setError(null);
      }
    } catch (err) {
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const updateSetting = <K extends keyof WorkerSettings>(
    key: K,
    value: WorkerSettings[K]
  ) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!settings || !dirty) return;

    setSaving(true);
    try {
      const res = await fetch("/api/settings/worker", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setDirty(false);
        setError(null);
      }
    } catch (err) {
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const togglePause = async () => {
    if (!settings) return;
    const newPaused = !settings["worker.paused"];
    updateSetting("worker.paused", newPaused);

    // Save immediately
    try {
      await fetch("/api/settings/worker", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "worker.paused": newPaused }),
      });
      setDirty(false);
    } catch (err) {
      setError("Failed to toggle pause");
    }
  };

  // Calculate worker status
  const lastHeartbeat = worker?.last_heartbeat
    ? new Date(worker.last_heartbeat)
    : null;
  const isAlive = lastHeartbeat && Date.now() - lastHeartbeat.getTime() < 60000;
  const isPaused = settings?.["worker.paused"] || worker?.is_paused;

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Worker Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure the background job worker
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-800 rounded-lg">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Worker Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Worker Status</CardTitle>
          <CardDescription>Current state of the background worker</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge
                variant={isPaused ? "secondary" : isAlive ? "default" : "destructive"}
                className={
                  isPaused
                    ? "bg-amber-100 text-amber-800"
                    : isAlive
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }
              >
                {isPaused ? "Paused" : isAlive ? "Running" : "Stopped"}
              </Badge>
              {worker?.hostname && (
                <span className="text-sm text-muted-foreground">
                  on {worker.hostname} (PID: {worker.pid})
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={togglePause}
            >
              {isPaused ? (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4 mr-1" />
                  Pause
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Uptime</span>
              <p className="font-medium">
                {worker?.started_at
                  ? formatDuration(Date.now() - new Date(worker.started_at).getTime())
                  : "N/A"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Last Heartbeat</span>
              <p className="font-medium">
                {lastHeartbeat
                  ? `${Math.round((Date.now() - lastHeartbeat.getTime()) / 1000)}s ago`
                  : "Never"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Jobs Processed</span>
              <p className="font-medium">{worker?.jobs_processed || 0}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Jobs Failed</span>
              <p className={`font-medium ${(worker?.jobs_failed || 0) > 0 ? "text-red-600" : ""}`}>
                {worker?.jobs_failed || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rate Limits Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rate Limits</CardTitle>
          <CardDescription>Applies to ALL outbound emails</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="hourly">Hourly Limit</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="hourly"
                  type="number"
                  value={settings?.["worker.rate_limit_hourly"] || 1000}
                  onChange={(e) =>
                    updateSetting("worker.rate_limit_hourly", parseInt(e.target.value) || 1000)
                  }
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">emails/hour</span>
              </div>
              {rateStatus && (
                <p className="text-sm text-muted-foreground">
                  Current: {rateStatus.hourly_count} / {settings?.["worker.rate_limit_hourly"]}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="daily">Daily Limit</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="daily"
                  type="number"
                  value={settings?.["worker.rate_limit_daily"] || 10000}
                  onChange={(e) =>
                    updateSetting("worker.rate_limit_daily", parseInt(e.target.value) || 10000)
                  }
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">emails/day</span>
              </div>
              {rateStatus && (
                <p className="text-sm text-muted-foreground">
                  Current: {rateStatus.daily_count} / {settings?.["worker.rate_limit_daily"]}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Default Timezone Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Default Timezone</CardTitle>
          <CardDescription>Campaigns inherit this unless overridden</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={settings?.["worker.default_timezone"] || "America/Los_Angeles"}
            onValueChange={(v) => updateSetting("worker.default_timezone", v)}
          >
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Job Intervals Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Job Intervals</CardTitle>
          <CardDescription>How often background jobs run</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="sync">Email Sync</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="sync"
                  type="number"
                  value={settings?.["worker.interval_email_sync"] || 15}
                  onChange={(e) =>
                    updateSetting("worker.interval_email_sync", parseInt(e.target.value) || 15)
                  }
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">minutes</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="replies">Check Replies</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="replies"
                  type="number"
                  value={settings?.["worker.interval_check_replies"] || 5}
                  onChange={(e) =>
                    updateSetting("worker.interval_check_replies", parseInt(e.target.value) || 5)
                  }
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">minutes</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="queue">Queue Process</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="queue"
                  type="number"
                  value={settings?.["worker.interval_queue_process"] || 30}
                  onChange={(e) =>
                    updateSetting("worker.interval_queue_process", parseInt(e.target.value) || 30)
                  }
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">seconds</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Sending Card - Prominent toggle */}
      <Card className={settings?.["worker.dry_run"] !== false ? "border-amber-200 bg-amber-50/50" : "border-green-200 bg-green-50/50"}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {settings?.["worker.dry_run"] !== false ? (
              <MailX className="h-5 w-5 text-amber-600" />
            ) : (
              <Mail className="h-5 w-5 text-green-600" />
            )}
            Email Sending
          </CardTitle>
          <CardDescription>
            Control whether campaign emails are actually sent
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="email-sending" className="text-base font-medium">
                {settings?.["worker.dry_run"] !== false ? "Emails Disabled (Dry Run)" : "Emails Enabled"}
              </Label>
              <p className="text-sm text-muted-foreground">
                {settings?.["worker.dry_run"] !== false
                  ? "Emails are logged but NOT actually sent. Enable to start sending."
                  : "Emails will be sent to recipients. Disable to stop all sending."}
              </p>
            </div>
            <Switch
              id="email-sending"
              checked={settings?.["worker.dry_run"] === false}
              onCheckedChange={(checked) =>
                updateSetting("worker.dry_run", !checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Advanced Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Advanced</CardTitle>
          <CardDescription>Development and debugging options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="debug"
              checked={settings?.["worker.debug"] || false}
              onCheckedChange={(checked) =>
                updateSetting("worker.debug", checked === true)
              }
            />
            <div className="grid gap-1.5 leading-none">
              <Label htmlFor="debug">Debug Logging</Label>
              <p className="text-sm text-muted-foreground">
                Enable verbose logging for troubleshooting
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info footer */}
      <p className="text-sm text-muted-foreground text-center">
        Send windows and email spacing are configured per-campaign in the campaign settings.
      </p>
    </div>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
