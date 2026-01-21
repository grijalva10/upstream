"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface HeaderBarProps {
  workerRunning: boolean;
  workerPaused: boolean;
  onTogglePause?: () => void;
}

export function HeaderBar({ workerRunning, workerPaused, onTogglePause }: HeaderBarProps) {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleDateString("en-US", { weekday: "short" }) +
          " " +
          now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const status = workerPaused ? "paused" : workerRunning ? "running" : "stopped";
  const statusColor = workerPaused
    ? "text-amber-500"
    : workerRunning
      ? "text-emerald-500"
      : "text-red-500";

  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-border/50">
      <h1 className="text-sm font-semibold tracking-tight">UPSTREAM</h1>
      <div className="flex items-center gap-4">
        <button
          onClick={onTogglePause}
          className="flex items-center gap-2 text-xs hover:opacity-80 transition-opacity"
          title={workerPaused ? "Resume worker" : "Pause worker"}
        >
          <span className="text-muted-foreground">Worker</span>
          <span className={cn("font-mono", statusColor)}>
            {workerPaused ? "○" : "●"} {status}
          </span>
        </button>
        <span className="text-xs font-mono text-muted-foreground">{time}</span>
      </div>
    </div>
  );
}
