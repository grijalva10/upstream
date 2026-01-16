import {
  Users,
  Send,
  Mail,
  MessageSquare,
  XCircle,
  Calendar,
  Clock,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { CampaignWithSearch } from "../../_lib/types";
import { calculateMetrics, formatRate, formatDateTime, getCampaignEmails } from "../../_lib/utils";

interface OverviewTabProps {
  campaign: CampaignWithSearch;
}

export function OverviewTab({ campaign }: OverviewTabProps) {
  const metrics = calculateMetrics(campaign);
  const emails = getCampaignEmails(campaign);

  return (
    <div className="space-y-8">
      {/* Performance Metrics */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Performance
        </h2>
        <MetricsGrid metrics={metrics} />
      </section>

      {/* Email Sequence Timeline */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Email Sequence
        </h2>
        <EmailTimeline emails={emails} />
      </section>

      {/* Campaign Timeline */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Timeline
        </h2>
        <CampaignTimeline campaign={campaign} />
      </section>
    </div>
  );
}

interface MetricsGridProps {
  metrics: ReturnType<typeof calculateMetrics>;
}

function MetricsGrid({ metrics }: MetricsGridProps) {
  const items = [
    {
      label: "Enrolled",
      value: metrics.enrolled,
      rate: null,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/50",
      progressColor: "bg-blue-500",
    },
    {
      label: "Sent",
      value: metrics.sent,
      rate: metrics.sentRate,
      icon: Send,
      color: "text-slate-600 dark:text-slate-400",
      bgColor: "bg-slate-50 dark:bg-slate-900/50",
      progressColor: "bg-slate-500",
      baseValue: metrics.enrolled,
    },
    {
      label: "Opened",
      value: metrics.opened,
      rate: metrics.openRate,
      icon: Mail,
      color: "text-amber-600",
      bgColor: "bg-amber-50 dark:bg-amber-950/50",
      progressColor: "bg-amber-500",
      baseValue: metrics.sent,
    },
    {
      label: "Replied",
      value: metrics.replied,
      rate: metrics.replyRate,
      icon: MessageSquare,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/50",
      progressColor: "bg-emerald-500",
      baseValue: metrics.sent,
    },
    {
      label: "Stopped",
      value: metrics.stopped,
      rate: metrics.stopRate,
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950/50",
      progressColor: "bg-red-500",
      baseValue: metrics.enrolled,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      {items.map(({ label, value, rate, icon: Icon, color, bgColor, progressColor, baseValue }) => {
        const progressValue = baseValue && baseValue > 0 ? (value / baseValue) * 100 : 0;

        return (
          <div
            key={label}
            className={`relative overflow-hidden rounded-xl border p-4 ${bgColor}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`${color}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              {rate !== null && rate > 0 && (
                <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  {formatRate(rate)}
                </span>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-semibold tracking-tight">{value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
            {baseValue !== undefined && baseValue > 0 && (
              <div className="mt-3">
                <Progress
                  value={progressValue}
                  className={`h-1 bg-background/50`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface EmailTimelineProps {
  emails: ReturnType<typeof getCampaignEmails>;
}

function EmailTimeline({ emails }: EmailTimelineProps) {
  return (
    <div className="relative">
      {/* Connection line */}
      <div className="absolute left-[23px] top-8 bottom-8 w-px bg-border hidden sm:block" />

      <div className="space-y-4">
        {emails.map((email, index) => (
          <div
            key={email.number}
            className="relative flex gap-4 p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors"
          >
            {/* Step indicator */}
            <div className="relative z-10 flex-shrink-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-sm">
                {email.number}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <p className="font-medium truncate">
                  {email.subject || <span className="text-muted-foreground italic">No subject</span>}
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {email.number === 1 ? "Sent immediately" : `+${email.delayDays ?? 0} days`}
                </span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {email.body
                  ? email.body.slice(0, 120) + (email.body.length > 120 ? "..." : "")
                  : "No content"}
              </p>
            </div>

            {/* Arrow indicator for sequence */}
            {index < emails.length - 1 && (
              <div className="hidden sm:flex items-center text-muted-foreground/50">
                <ArrowRight className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CampaignTimeline({ campaign }: { campaign: CampaignWithSearch }) {
  const events = [
    {
      label: "Created",
      date: campaign.created_at,
      icon: Calendar,
      color: "text-blue-600",
    },
    campaign.started_at && {
      label: "Started",
      date: campaign.started_at,
      icon: Clock,
      color: "text-emerald-600",
    },
    campaign.completed_at && {
      label: "Completed",
      date: campaign.completed_at,
      icon: Clock,
      color: "text-slate-600",
    },
  ].filter(Boolean) as Array<{
    label: string;
    date: string;
    icon: typeof Calendar;
    color: string;
  }>;

  return (
    <div className="flex flex-wrap gap-6">
      {events.map(({ label, date, icon: Icon, color }) => (
        <div key={label} className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-muted/50 ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-medium">{formatDateTime(date)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
