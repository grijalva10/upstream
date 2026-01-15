import Link from "next/link";
import { Send, Plus, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SearchCampaign } from "../../_lib/types";
import { canCreateCampaign } from "../../_lib/utils";

interface CampaignTabProps {
  campaigns: SearchCampaign[];
  searchStatus: string;
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  draft: "secondary",
  active: "default",
  paused: "outline",
  completed: "secondary",
};

export function CampaignTab({ campaigns, searchStatus }: CampaignTabProps) {
  const canCreate = canCreateCampaign(searchStatus);

  if (campaigns.length === 0) {
    return <EmptyState canCreate={canCreate} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base sm:text-lg font-medium">Campaigns ({campaigns.length})</h3>
        {canCreate && (
          <Button disabled className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Create Campaign
          </Button>
        )}
      </div>
      <div className="grid gap-3 sm:gap-4">
        {campaigns.map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-12 px-4 border rounded-lg bg-muted/20 text-center">
      <Send className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/50 mb-4" aria-hidden="true" />
      <p className="text-sm sm:text-base text-muted-foreground mb-4">No campaigns created yet</p>
      {canCreate ? (
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Create Campaign
        </Button>
      ) : (
        <p className="text-xs sm:text-sm text-muted-foreground">
          Complete the search extraction to create a campaign
        </p>
      )}
      <p className="text-xs text-muted-foreground mt-4">
        Campaign creation coming in the next build step
      </p>
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: SearchCampaign }) {
  const variant = STATUS_VARIANTS[campaign.status] ?? "outline";

  const metrics = [
    { label: "enrolled", value: campaign.total_enrolled },
    { label: "sent", value: campaign.total_sent },
    { label: "opened", value: campaign.total_opened },
    { label: "replied", value: campaign.total_replied },
  ];

  return (
    <Card>
      <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm sm:text-base truncate">{campaign.name}</CardTitle>
          <Badge variant={variant} className="text-xs shrink-0">{campaign.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm text-muted-foreground">
            {metrics.map(({ label, value }) => (
              <span key={label}>
                <span className="font-medium text-foreground">{value}</span> {label}
              </span>
            ))}
          </div>
          <Button variant="ghost" size="sm" asChild className="w-full sm:w-auto justify-center">
            <Link href={`/campaigns/${campaign.id}`}>
              View Campaign
              <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
