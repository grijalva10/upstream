"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Square,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface SessionStatus {
  status: "offline" | "starting" | "authenticating" | "connected" | "error";
  started_at: string | null;
  last_activity: string | null;
  last_auth: string | null;
  error: string | null;
  queries_run: number;
  session_valid: boolean;
  expires_in_minutes: number;
}

const STATUS_CONFIG = {
  offline: {
    label: "Offline",
    variant: "secondary" as const,
    icon: XCircle,
    color: "text-gray-500",
  },
  starting: {
    label: "Starting...",
    variant: "secondary" as const,
    icon: Loader2,
    color: "text-blue-500",
  },
  authenticating: {
    label: "Authenticating",
    variant: "secondary" as const,
    icon: Clock,
    color: "text-amber-500",
  },
  connected: {
    label: "Connected",
    variant: "default" as const,
    icon: CheckCircle2,
    color: "text-green-500",
  },
  error: {
    label: "Error",
    variant: "destructive" as const,
    icon: AlertCircle,
    color: "text-red-500",
  },
};

export default function CoStarSettingsPage() {
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/costar/status");
      const data = await res.json();
      setStatus(data);
    } catch (error) {
      setStatus({
        status: "offline",
        started_at: null,
        last_activity: null,
        last_auth: null,
        error: "Failed to fetch status",
        queries_run: 0,
        session_valid: false,
        expires_in_minutes: 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Poll every 5 seconds
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleStart = async () => {
    setActionLoading("start");
    try {
      const res = await fetch("/api/costar/start", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to start session");
      }
      fetchStatus();
    } catch (error) {
      alert("Failed to start session - is the CoStar service running?");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async () => {
    setActionLoading("stop");
    try {
      await fetch("/api/costar/stop", { method: "POST" });
      fetchStatus();
    } catch (error) {
      alert("Failed to stop session");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAuth = async () => {
    setActionLoading("auth");
    try {
      const res = await fetch("/api/costar/auth", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to trigger auth");
      }
      fetchStatus();
    } catch (error) {
      alert("Failed to trigger authentication");
    } finally {
      setActionLoading(null);
    }
  };

  const statusConfig = status ? STATUS_CONFIG[status.status] : STATUS_CONFIG.offline;
  const StatusIcon = statusConfig.icon;

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "Never";
    const date = new Date(isoString);
    return date.toLocaleTimeString();
  };

  const formatDuration = (isoString: string | null) => {
    if (!isoString) return "-";
    const start = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m`;
    }
    return `${diffMins}m`;
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">CoStar Session</h1>
        <p className="text-sm text-muted-foreground">
          Manage the persistent browser session for CoStar queries
        </p>
      </div>

      {/* Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Session Status</span>
            <Badge variant={statusConfig.variant} className="text-sm">
              <StatusIcon
                className={`h-4 w-4 mr-1 ${
                  status?.status === "starting" ? "animate-spin" : ""
                }`}
              />
              {statusConfig.label}
            </Badge>
          </CardTitle>
          <CardDescription>
            {status?.status === "offline" && "Start the session to enable CoStar queries"}
            {status?.status === "connected" && status.session_valid &&
              `Session valid for ${status.expires_in_minutes} more minutes`}
            {status?.status === "connected" && !status.session_valid &&
              "Session expired - please re-authenticate"}
            {status?.status === "error" && status.error}
            {status?.status === "authenticating" && "Complete authentication in the browser window"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stats */}
              {status?.status === "connected" && (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Uptime</div>
                    <div className="font-medium">{formatDuration(status.started_at)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Last Auth</div>
                    <div className="font-medium">{formatTime(status.last_auth)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Queries Run</div>
                    <div className="font-medium">{status.queries_run}</div>
                  </div>
                </div>
              )}

              {/* Session Expiry Warning */}
              {status?.status === "connected" && status.expires_in_minutes < 30 && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg text-amber-700 dark:text-amber-300 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>
                    Session expires in {status.expires_in_minutes} minutes. Re-authenticate soon.
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                {status?.status === "offline" || status?.status === "error" ? (
                  <Button onClick={handleStart} disabled={actionLoading === "start"}>
                    {actionLoading === "start" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Start Session
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleStop}
                      disabled={actionLoading === "stop" || status?.status === "starting"}
                    >
                      {actionLoading === "stop" ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Square className="h-4 w-4 mr-2" />
                      )}
                      Stop
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleAuth}
                      disabled={
                        actionLoading === "auth" ||
                        status?.status !== "connected"
                      }
                    >
                      {actionLoading === "auth" ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Re-authenticate
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <p>
            <strong>1. Start the CoStar service</strong> (first time only):
          </p>
          <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
            python integrations/costar/service.py
          </pre>
          <p>
            <strong>2. Click "Start Session"</strong> above. A browser window will open.
          </p>
          <p>
            <strong>3. Scan the QR code</strong> with your phone to complete 2FA.
          </p>
          <p>
            <strong>4. Keep the browser open.</strong> The worker will use this session
            for CoStar queries. Sessions expire after ~2 hours - click "Re-authenticate"
            when prompted.
          </p>
          <p className="text-amber-600 dark:text-amber-400">
            <strong>Note:</strong> For stealth, queries only run during business hours (9am-6pm).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
