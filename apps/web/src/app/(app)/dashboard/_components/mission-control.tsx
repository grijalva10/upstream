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
    <div className="min-h-screen lg:h-screen flex flex-col bg-background">
      <HeaderBar
        workerRunning={data.worker.isRunning}
        workerPaused={data.worker.isPaused}
        onTogglePause={handleTogglePause}
      />

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr] md:grid-rows-[1fr_1fr_auto] lg:grid-rows-[1fr_1fr] gap-px bg-border/30 min-h-0 overflow-y-auto lg:overflow-hidden">
        {/* Attention - Row 1, Col 1 */}
        <div className="bg-background p-3 md:p-4">
          <AttentionPanel items={data.attention} />
        </div>

        {/* Pipeline - Row 1, Col 2 */}
        <div className="bg-background p-3 md:p-4">
          <PipelineFlow leadStages={data.leadStages} dealStages={data.dealStages} />
        </div>

        {/* Jobs - Row 2, Col 1 */}
        <div className="bg-background p-3 md:p-4">
          <JobsPanel jobs={data.jobs} />
        </div>

        {/* Searches - Row 2, Col 2 */}
        <div className="bg-background p-3 md:p-4">
          <SearchesPanel searches={data.searches} totalCount={data.searchesTotal} />
        </div>

        {/* Campaigns - Full width on tablet, right column spanning both rows on desktop */}
        <div className="bg-background p-3 md:p-4 md:col-span-2 lg:col-span-1 lg:row-span-2 lg:row-start-1 lg:col-start-3">
          <CampaignsPanel campaigns={data.campaigns} />
        </div>
      </div>

      <ServicesBar services={data.services} />

      <KeyboardShortcuts onRefresh={handleRefresh} />
    </div>
  );
}
