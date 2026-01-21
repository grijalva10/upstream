"use client";

import { useRouter } from "next/navigation";
import { HeaderBar } from "./header-bar";
import { AttentionPanel } from "./attention-panel";
import { PipelineFlow } from "./pipeline-flow";
import { CampaignsPanel } from "./campaigns-panel";
import { JobsPanel } from "./jobs-panel";
import { SearchesPanel } from "./searches-panel";
import { ServicesBar } from "./services-bar";
import { KeyboardShortcuts } from "./keyboard-shortcuts";

export interface DashboardData {
  attention: {
    label: string;
    count: number;
    href: string;
    urgent: boolean;
  }[];
  leadStages: {
    name: string;
    abbrev: string;
    count: number;
  }[];
  dealStages: {
    name: string;
    abbrev: string;
    count: number;
  }[];
  campaigns: {
    id: string;
    name: string;
    status: string;
    totalEnrolled: number;
    totalReplied: number;
    hotCount: number;
  }[];
  jobs: {
    name: string;
    displayName: string;
    lastRun: Date | null;
    nextRun: string;
    status: "healthy" | "warning" | "error" | "idle";
    recentRuns: { completedAt: Date; output: string | null }[];
  }[];
  searches: {
    id: string;
    name: string;
    status: string;
    propertyCount: number | null;
  }[];
  searchesTotal: number;
  services: {
    name: string;
    lastActive: Date | null;
    status: "healthy" | "warning" | "error";
    detail: string;
  }[];
  worker: {
    isRunning: boolean;
    isPaused: boolean;
  };
}

interface MissionControlProps {
  data: DashboardData;
}

export function MissionControl({ data }: MissionControlProps) {
  const router = useRouter();

  const handleRefresh = () => {
    router.refresh();
  };

  const handleTogglePause = async () => {
    try {
      await fetch("/api/worker/toggle-pause", { method: "POST" });
      router.refresh();
    } catch (error) {
      console.error("Failed to toggle worker pause:", error);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <HeaderBar
        workerRunning={data.worker.isRunning}
        workerPaused={data.worker.isPaused}
        onTogglePause={handleTogglePause}
      />

      <div className="flex-1 grid grid-cols-[1fr_1fr_1.2fr] grid-rows-[1fr_1fr] gap-px bg-border/30 min-h-0">
        {/* Row 1, Col 1: Attention */}
        <div className="bg-background p-4">
          <AttentionPanel items={data.attention} />
        </div>

        {/* Row 1, Col 2: Pipeline */}
        <div className="bg-background p-4">
          <PipelineFlow leadStages={data.leadStages} dealStages={data.dealStages} />
        </div>

        {/* Row 1-2, Col 3: Campaigns (spans both rows) */}
        <div className="bg-background p-4 row-span-2">
          <CampaignsPanel campaigns={data.campaigns} />
        </div>

        {/* Row 2, Col 1: Jobs */}
        <div className="bg-background p-4">
          <JobsPanel jobs={data.jobs} />
        </div>

        {/* Row 2, Col 2: Searches */}
        <div className="bg-background p-4">
          <SearchesPanel searches={data.searches} totalCount={data.searchesTotal} />
        </div>
      </div>

      <ServicesBar services={data.services} />

      <KeyboardShortcuts onRefresh={handleRefresh} />
    </div>
  );
}
