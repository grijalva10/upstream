"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Power,
  PowerOff,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface OrchestratorControlsProps {
  isRunning: boolean;
  lastHeartbeat: Date | null;
  hostname: string | null;
  pid: number | null;
  startedAt: Date | null;
  loopsEnabled: { send?: boolean; response?: boolean } | null;
  dryRun: boolean;
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

export function OrchestratorControls({
  isRunning,
  lastHeartbeat,
  hostname,
  pid,
  startedAt,
  loopsEnabled,
  dryRun: initialDryRun,
}: OrchestratorControlsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Options for starting - dry run ON by default for safety
  const [dryRun, setDryRun] = useState(true);
  const [sendLoop, setSendLoop] = useState(true);
  const [responseLoop, setResponseLoop] = useState(true);

  const handleStart = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          dryRun,
          sendLoop,
          responseLoop,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start orchestrator");
      }

      // Refresh the page to show new status
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to stop orchestrator");
      }

      // Refresh the page to show new status
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <Card className={`mb-6 ${isRunning ? "border-green-500" : "border-red-500"} border-2`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {isRunning ? (
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Power className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            ) : (
              <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <PowerOff className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold">
                {isRunning ? "Running" : "Stopped"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isRunning ? (
                  <>
                    Last heartbeat: {formatTimeAgo(lastHeartbeat)}
                    {initialDryRun && (
                      <span className="ml-2 text-yellow-600">(Dry Run Mode)</span>
                    )}
                  </>
                ) : (
                  "Orchestrator is not running"
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Status info */}
            {isRunning && (
              <div className="text-right text-sm text-muted-foreground mr-4">
                <p>Host: {hostname || "Unknown"}</p>
                <p>PID: {pid || "Unknown"}</p>
                {startedAt && <p>Started: {formatTimeAgo(startedAt)}</p>}
                {loopsEnabled && (
                  <p>
                    Loops: {loopsEnabled.send && "Send "}{loopsEnabled.response && "Response"}
                  </p>
                )}
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>

              {isRunning ? (
                <Button
                  variant="destructive"
                  onClick={handleStop}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <PowerOff className="h-4 w-4 mr-2" />
                  )}
                  Stop
                </Button>
              ) : (
                <Button
                  variant="default"
                  onClick={handleStart}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Power className="h-4 w-4 mr-2" />
                  )}
                  Start
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Start options (shown when stopped) */}
        {!isRunning && (
          <div className="mt-4 pt-4 border-t flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="dryRun"
                checked={dryRun}
                onCheckedChange={(checked) => setDryRun(!!checked)}
              />
              <Label htmlFor="dryRun" className="text-sm font-medium">
                Dry Run <span className="text-muted-foreground font-normal">(no actual sends)</span>
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="sendLoop"
                checked={sendLoop}
                onCheckedChange={(checked) => setSendLoop(!!checked)}
              />
              <Label htmlFor="sendLoop" className="text-sm">Send Loop</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="responseLoop"
                checked={responseLoop}
                onCheckedChange={(checked) => setResponseLoop(!!checked)}
              />
              <Label htmlFor="responseLoop" className="text-sm">Response Loop</Label>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
