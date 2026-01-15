"use client";

import Link from "next/link";
import { Building2, Users, Mail, Calendar, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SearchWithRelations } from "../_lib/types";
import { StatusBadge, getSourceLabel, getCriteriaSummary, isProcessing } from "../_lib/utils";

interface SearchCardProps {
  search: SearchWithRelations;
}

export function SearchCard({ search }: SearchCardProps) {
  const summary = getCriteriaSummary(search.criteria_json);
  const hasCampaign = search.campaigns?.length > 0;
  const processing = isProcessing(search.status);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-base">
              <Link
                href={`/searches/${search.id}`}
                className="hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
              >
                {search.name}
              </Link>
            </CardTitle>
            <p className="text-sm text-muted-foreground truncate">{summary}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="outline" className="text-xs">{getSourceLabel(search.source)}</Badge>
            <StatusBadge status={search.status} size="sm" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Stats search={search} />
          <Actions
            searchId={search.id}
            status={search.status}
            processing={processing}
            hasCampaign={hasCampaign}
            campaignId={search.campaigns?.[0]?.id}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Stats({ search }: { search: SearchWithRelations }) {
  const items = [
    { icon: Building2, value: search.total_properties ?? 0, label: "properties" },
    { icon: Users, value: search.total_companies ?? 0, label: "companies" },
    { icon: Mail, value: search.total_contacts ?? 0, label: "contacts" },
    { icon: Calendar, value: search.created_at ? new Date(search.created_at).toLocaleDateString() : "—", label: "created date" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
      {items.map(({ icon: Icon, value, label }) => (
        <span key={label} className="flex items-center gap-1">
          <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
          <span aria-label={`${value} ${label}`}>{value}</span>
        </span>
      ))}
    </div>
  );
}

interface ActionsProps {
  searchId: string;
  status: string;
  processing: boolean;
  hasCampaign: boolean;
  campaignId?: string;
}

function Actions({ searchId, status, processing, hasCampaign, campaignId }: ActionsProps) {
  if (processing) {
    return (
      <Button size="sm" variant="ghost" asChild>
        <Link href={`/searches/${searchId}`}>
          View Progress
          <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </Button>
    );
  }

  if (hasCampaign && campaignId) {
    return (
      <Button size="sm" variant="ghost" asChild>
        <Link href={`/campaigns/${campaignId}`}>
          View Campaign
          <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </Button>
    );
  }

  if (status === "ready") {
    return (
      <Button size="sm" variant="outline" disabled aria-label="Create campaign (coming soon)">
        Create Campaign
      </Button>
    );
  }

  return null;
}
