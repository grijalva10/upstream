"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Campaign {
  id: string;
  name: string;
  status: string;
  totalEnrolled: number;
  totalReplied: number;
}

interface CampaignsCardProps {
  campaigns: Campaign[];
}

const statusColors: Record<string, string> = {
  draft: "bg-zinc-500",
  scheduled: "bg-blue-500",
  active: "bg-emerald-500",
  paused: "bg-amber-500",
  completed: "bg-purple-500",
};

const PAGE_SIZE = 5;

export function CampaignsCard({ campaigns }: CampaignsCardProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(campaigns.length / PAGE_SIZE);
  const start = page * PAGE_SIZE;
  const visible = campaigns.slice(start, start + PAGE_SIZE);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Campaigns</CardTitle>
          <span className="text-xs text-muted-foreground">
            {campaigns.length} total
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <Send className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No campaigns</p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              {visible.map((campaign, index) => (
                <div
                  key={campaign.id}
                  className={cn(
                    "flex items-center gap-3 py-2",
                    index !== visible.length - 1 && "border-b border-border"
                  )}
                >
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full flex-shrink-0",
                      statusColors[campaign.status] || "bg-zinc-500"
                    )}
                  />

                  <span className="text-sm flex-1 truncate">{campaign.name}</span>

                  <span className="text-xs text-muted-foreground font-mono">
                    {campaign.totalReplied}/{campaign.totalEnrolled}
                  </span>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="h-7 px-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  className="h-7 px-2"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
