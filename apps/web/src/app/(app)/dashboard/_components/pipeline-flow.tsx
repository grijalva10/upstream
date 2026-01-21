"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface PipelineStage {
  name: string;
  abbrev: string;
  count: number;
}

interface PipelineRowProps {
  label: string;
  stages: PipelineStage[];
  href: string;
}

function PipelineRow({ label, stages, href }: PipelineRowProps) {
  return (
    <Link href={href} className="block group">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider w-12">
          {label}
        </span>
        <div className="flex items-baseline gap-1 flex-1">
          {stages.map((stage, index) => (
            <div key={stage.name} className="flex items-baseline">
              <span
                className={cn(
                  "font-mono text-sm tabular-nums",
                  stage.count > 0 ? "text-foreground font-medium" : "text-muted-foreground/50"
                )}
              >
                {stage.count}
              </span>
              {index < stages.length - 1 && (
                <span className="text-muted-foreground/30 mx-1 text-xs">→</span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-baseline gap-1 ml-14">
        {stages.map((stage, index) => (
          <div key={stage.name} className="flex items-baseline">
            <span className="text-[10px] text-muted-foreground/60 font-mono">
              {stage.abbrev}
            </span>
            {index < stages.length - 1 && (
              <span className="text-transparent mx-1 text-xs">→</span>
            )}
          </div>
        ))}
      </div>
    </Link>
  );
}

interface PipelineFlowProps {
  leadStages: PipelineStage[];
  dealStages: PipelineStage[];
}

export function PipelineFlow({ leadStages, dealStages }: PipelineFlowProps) {
  return (
    <div className="h-full flex flex-col">
      <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Pipeline
      </h2>
      <div className="space-y-4">
        <PipelineRow label="Leads" stages={leadStages} href="/leads" />
        <PipelineRow label="Deals" stages={dealStages} href="/pipeline" />
      </div>
    </div>
  );
}
