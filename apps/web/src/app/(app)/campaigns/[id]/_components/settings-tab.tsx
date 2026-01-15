import { Clock, Globe, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CampaignWithSearch } from "../../_lib/types";
import { formatTime } from "../../_lib/utils";

interface SettingsTabProps {
  campaign: CampaignWithSearch;
}

export function SettingsTab({ campaign }: SettingsTabProps) {
  return (
    <div className="space-y-6">
      <SendWindowCard campaign={campaign} />
      <EmailDelaysCard campaign={campaign} />
    </div>
  );
}

function SendWindowCard({ campaign }: { campaign: CampaignWithSearch }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" aria-hidden="true" />
          Send Window
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SettingItem
            label="Start Time"
            value={formatTime(campaign.send_window_start)}
          />
          <SettingItem
            label="End Time"
            value={formatTime(campaign.send_window_end)}
          />
          <SettingItem
            icon={Globe}
            label="Timezone"
            value={campaign.timezone ?? "America/Los_Angeles"}
          />
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Emails will only be sent during this window in the specified timezone.
        </p>
      </CardContent>
    </Card>
  );
}

function EmailDelaysCard({ campaign }: { campaign: CampaignWithSearch }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" aria-hidden="true" />
          Email Sequence Timing
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SettingItem label="Email 1" value="Sent immediately" />
          <SettingItem
            label="Email 2"
            value={`+${campaign.email_2_delay_days ?? 3} days`}
          />
          <SettingItem
            label="Email 3"
            value={`+${campaign.email_3_delay_days ?? 4} days after Email 2`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface SettingItemProps {
  icon?: typeof Clock;
  label: string;
  value: string;
}

function SettingItem({ icon: Icon, label, value }: SettingItemProps) {
  return (
    <div className="p-3 bg-muted/50 rounded-lg">
      <p className="text-xs sm:text-sm text-muted-foreground mb-1 flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
        {label}
      </p>
      <p className="text-sm sm:text-base font-medium">{value}</p>
    </div>
  );
}
