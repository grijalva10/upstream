"use client";

import Link from "next/link";
import { Calendar, Users, Send, Mail, MessageSquare, XCircle, ArrowRight, Pause, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CampaignWithSearch } from "../_lib/types";
import { CampaignStatusBadge, calculateMetrics, formatRate, formatDate, canPause, canResume } from "../_lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface CampaignCardProps {
  campaign: CampaignWithSearch;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const metrics = calculateMetrics(campaign);

  const handleStatusChange = async (newStatus: "active" | "paused") => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to update campaign status:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3 p-3 sm:p-6 sm:pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-base">
              <Link
                href={`/campaigns/${campaign.id}`}
                className="hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
              >
                {campaign.name}
              </Link>
            </CardTitle>
            {campaign.search && (
              <p className="text-sm text-muted-foreground truncate">
                From: {campaign.search.name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <CampaignStatusBadge status={campaign.status} size="sm" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 p-3 sm:p-6 sm:pt-0 space-y-4">
        <MetricsRow metrics={metrics} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <MetaInfo campaign={campaign} />
          <Actions
            campaignId={campaign.id}
            status={campaign.status}
            isUpdating={isUpdating}
            onStatusChange={handleStatusChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface MetricsRowProps {
  metrics: ReturnType<typeof calculateMetrics>;
}

function MetricsRow({ metrics }: MetricsRowProps) {
  const items = [
    { label: "Enrolled", value: metrics.enrolled, rate: null, icon: Users },
    { label: "Sent", value: metrics.sent, rate: metrics.sentRate, icon: Send },
    { label: "Opened", value: metrics.opened, rate: metrics.openRate, icon: Mail },
    { label: "Replied", value: metrics.replied, rate: metrics.replyRate, icon: MessageSquare },
    { label: "Stopped", value: metrics.stopped, rate: metrics.stopRate, icon: XCircle },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
      {items.map(({ label, value, rate, icon: Icon }) => (
        <div
          key={label}
          className="flex flex-col items-center p-2 sm:p-3 rounded-lg bg-muted/50 text-center"
        >
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground mb-1" aria-hidden="true" />
          <span className="text-lg sm:text-xl font-bold">{value}</span>
          <span className="text-[10px] sm:text-xs text-muted-foreground">{label}</span>
          {rate !== null && (
            <span className="text-[10px] sm:text-xs text-muted-foreground">{formatRate(rate)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function MetaInfo({ campaign }: { campaign: CampaignWithSearch }) {
  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
      <span className="flex items-center gap-1">
        <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
        {campaign.started_at ? (
          <span>Started {formatDate(campaign.started_at)}</span>
        ) : (
          <span>Created {formatDate(campaign.created_at)}</span>
        )}
      </span>
    </div>
  );
}

interface ActionsProps {
  campaignId: string;
  status: string;
  isUpdating: boolean;
  onStatusChange: (status: "active" | "paused") => void;
}

function Actions({ campaignId, status, isUpdating, onStatusChange }: ActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {canPause(status) && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onStatusChange("paused")}
          disabled={isUpdating}
        >
          <Pause className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
          Pause
        </Button>
      )}
      {canResume(status) && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onStatusChange("active")}
          disabled={isUpdating}
        >
          <Play className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
          Resume
        </Button>
      )}
      <Button size="sm" variant="ghost" asChild>
        <Link href={`/campaigns/${campaignId}`}>
          View Details
          <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}
