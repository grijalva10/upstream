import { Users, Send, Mail, MessageSquare, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CampaignWithSearch } from "../../_lib/types";
import { calculateMetrics, formatRate, formatDateTime, getCampaignEmails } from "../../_lib/utils";

interface OverviewTabProps {
  campaign: CampaignWithSearch;
}

export function OverviewTab({ campaign }: OverviewTabProps) {
  const metrics = calculateMetrics(campaign);
  const emails = getCampaignEmails(campaign);

  return (
    <div className="space-y-6">
      <MetricsGrid metrics={metrics} />
      <EmailPreviewCards emails={emails} />
      <Timestamps campaign={campaign} />
    </div>
  );
}

interface MetricsGridProps {
  metrics: ReturnType<typeof calculateMetrics>;
}

function MetricsGrid({ metrics }: MetricsGridProps) {
  const items = [
    { label: "Enrolled", value: metrics.enrolled, rate: null, icon: Users, color: "text-blue-600" },
    { label: "Sent", value: metrics.sent, rate: metrics.sentRate, icon: Send, color: "text-slate-600" },
    { label: "Opened", value: metrics.opened, rate: metrics.openRate, icon: Mail, color: "text-green-600" },
    { label: "Replied", value: metrics.replied, rate: metrics.replyRate, icon: MessageSquare, color: "text-emerald-600" },
    { label: "Stopped", value: metrics.stopped, rate: metrics.stopRate, icon: XCircle, color: "text-red-600" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
      {items.map(({ label, value, rate, icon: Icon, color }) => (
        <Card key={label}>
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${color}`} aria-hidden="true" />
              {label}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <span className="text-xl sm:text-2xl font-bold">{value}</span>
            {rate !== null && (
              <span className="text-xs sm:text-sm text-muted-foreground ml-2">
                {formatRate(rate)}
              </span>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface EmailPreviewCardsProps {
  emails: ReturnType<typeof getCampaignEmails>;
}

function EmailPreviewCards({ emails }: EmailPreviewCardsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Sequence</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {emails.map((email) => (
          <div
            key={email.number}
            className="p-3 sm:p-4 border rounded-lg bg-muted/30"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                  {email.number}
                </span>
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {email.number === 1
                    ? "Initial email"
                    : `+${email.delayDays ?? 0} days`}
                </span>
              </div>
            </div>
            <p className="text-sm sm:text-base font-medium truncate">
              {email.subject || "No subject set"}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">
              {email.body
                ? email.body.slice(0, 150) + (email.body.length > 150 ? "..." : "")
                : "No body content set"}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Timestamps({ campaign }: { campaign: CampaignWithSearch }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6 text-xs sm:text-sm text-muted-foreground">
      <span className="flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
        Created: {formatDateTime(campaign.created_at)}
      </span>
      {campaign.started_at && (
        <span className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
          Started: {formatDateTime(campaign.started_at)}
        </span>
      )}
      {campaign.completed_at && (
        <span className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
          Completed: {formatDateTime(campaign.completed_at)}
        </span>
      )}
    </div>
  );
}
