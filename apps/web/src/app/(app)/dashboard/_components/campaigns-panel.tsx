"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Campaign {
  id: string;
  name: string;
  status: string;
  totalEnrolled: number;
  totalReplied: number;
  hotCount: number;
}

interface CampaignsPanelProps {
  campaigns: Campaign[];
}

const statusConfig: Record<string, { dot: string; color: string }> = {
  active: { dot: "●", color: "text-emerald-500" },
  paused: { dot: "○", color: "text-amber-500" },
  draft: { dot: "◐", color: "text-zinc-500" },
  completed: { dot: "✓", color: "text-zinc-600" },
  scheduled: { dot: "◷", color: "text-blue-500" },
};

export function CampaignsPanel({ campaigns }: CampaignsPanelProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Campaigns
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">
            {campaigns.length}
          </span>
          <Button variant="ghost" size="icon" className="h-5 w-5" asChild>
            <Link href="/campaigns/new">
              <Plus className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm text-muted-foreground">No campaigns</span>
        </div>
      ) : (
        <ScrollArea className="flex-1 -mx-1 px-1">
          <div className="space-y-1">
            {campaigns.map((campaign) => {
              const config = statusConfig[campaign.status] || statusConfig.draft;
              const replyRate =
                campaign.totalEnrolled > 0
                  ? Math.round((campaign.totalReplied / campaign.totalEnrolled) * 100)
                  : 0;

              return (
                <Link
                  key={campaign.id}
                  href={`/campaigns/${campaign.id}`}
                  className="block py-2 px-2 -mx-2 rounded hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="flex-1 text-sm truncate">{campaign.name}</span>
                    <span className={cn("text-xs", config.color)}>
                      {config.dot} {campaign.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                    <span>
                      {campaign.totalReplied}/{campaign.totalEnrolled}
                    </span>
                    <span>{replyRate}% reply</span>
                    {campaign.hotCount > 0 && (
                      <span className="text-amber-500">{campaign.hotCount} hot</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
