import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SearchCampaign } from "../../_lib/types";

interface CampaignSectionProps {
  campaigns: SearchCampaign[];
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  paused: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
};

export function CampaignSection({ campaigns }: CampaignSectionProps) {
  if (campaigns.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-medium text-muted-foreground mb-3">
        Campaigns ({campaigns.length})
      </h2>
      <div className="space-y-2">
        {campaigns.map((campaign) => (
          <Link
            key={campaign.id}
            href={`/campaigns/${campaign.id}`}
            className="group flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div>
                <p className="font-medium">{campaign.name}</p>
                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                  <span>
                    <strong className="text-foreground">{campaign.total_enrolled}</strong> enrolled
                  </span>
                  <span>
                    <strong className="text-foreground">{campaign.total_sent}</strong> sent
                  </span>
                  <span>
                    <strong className="text-foreground">{campaign.total_opened}</strong> opened
                  </span>
                  <span>
                    <strong className="text-foreground">{campaign.total_replied}</strong> replied
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={STATUS_COLORS[campaign.status] || STATUS_COLORS.draft}>
                {campaign.status}
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
