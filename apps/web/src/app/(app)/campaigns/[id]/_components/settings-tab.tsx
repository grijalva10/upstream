import { Clock, Globe, Mail, ArrowRight, Sun, Moon, Calendar } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { CampaignWithSearch } from "../../_lib/types";
import { formatTime } from "../../_lib/utils";

interface SettingsTabProps {
  campaign: CampaignWithSearch;
}

export function SettingsTab({ campaign }: SettingsTabProps) {
  return (
    <div className="space-y-8">
      {/* Send Window */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Send Window
          </h2>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              {/* Start time */}
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600">
                  <Sun className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Start</p>
                  <p className="text-lg font-semibold">
                    {formatTime(campaign.send_window_start)}
                  </p>
                </div>
              </div>

              {/* Arrow */}
              <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block" />

              {/* End time */}
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600">
                  <Moon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">End</p>
                  <p className="text-lg font-semibold">
                    {formatTime(campaign.send_window_end)}
                  </p>
                </div>
              </div>

              {/* Divider */}
              <Separator orientation="vertical" className="h-10 hidden sm:block" />

              {/* Timezone */}
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  <Globe className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Timezone</p>
                  <p className="text-sm font-medium">
                    {campaign.timezone ?? "America/Los_Angeles"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-3 bg-muted/30 border-t">
            <p className="text-xs text-muted-foreground">
              Emails will only be sent during this window to maximize deliverability and response rates.
            </p>
          </div>
        </div>
      </section>

      {/* Email Sequence Timing */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Sequence Timing
          </h2>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          {/* Visual timeline */}
          <div className="p-6">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-6 bottom-6 w-px bg-border" />

              <div className="space-y-6">
                {/* Email 1 */}
                <EmailTimingStep
                  number={1}
                  timing="Immediately"
                  description="Sent as soon as contact is enrolled"
                  isFirst
                />

                {/* Email 2 */}
                <EmailTimingStep
                  number={2}
                  timing={`${campaign.email_2_delay_days ?? 3} days`}
                  description="After Email 1 (if no reply)"
                />

                {/* Email 3 */}
                <EmailTimingStep
                  number={3}
                  timing={`${campaign.email_3_delay_days ?? 4} days`}
                  description="After Email 2 (if no reply)"
                  isLast
                />
              </div>
            </div>
          </div>

          <div className="px-6 py-3 bg-muted/30 border-t">
            <p className="text-xs text-muted-foreground">
              The sequence stops automatically when a contact replies to any email.
            </p>
          </div>
        </div>
      </section>

      {/* Summary Stats */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Sequence Duration
          </h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border bg-card">
            <p className="text-xs text-muted-foreground mb-1">Total Duration</p>
            <p className="text-2xl font-semibold">
              {(campaign.email_2_delay_days ?? 3) + (campaign.email_3_delay_days ?? 4)} days
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              From first to last email
            </p>
          </div>

          <div className="p-4 rounded-xl border bg-card">
            <p className="text-xs text-muted-foreground mb-1">Daily Send Window</p>
            <p className="text-2xl font-semibold">
              {calculateWindowHours(campaign.send_window_start, campaign.send_window_end)} hours
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Active sending time
            </p>
          </div>

          <div className="p-4 rounded-xl border bg-card">
            <p className="text-xs text-muted-foreground mb-1">Emails per Contact</p>
            <p className="text-2xl font-semibold">3 max</p>
            <p className="text-xs text-muted-foreground mt-1">
              Unless replied earlier
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

interface EmailTimingStepProps {
  number: number;
  timing: string;
  description: string;
  isFirst?: boolean;
  isLast?: boolean;
}

function EmailTimingStep({ number, timing, description, isFirst, isLast }: EmailTimingStepProps) {
  return (
    <div className="relative flex items-start gap-4 pl-0">
      {/* Step indicator */}
      <div className="relative z-10 flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-sm">
        {number}
      </div>

      {/* Content */}
      <div className="flex-1 pt-1">
        <div className="flex items-center gap-3">
          <p className="font-medium">Email {number}</p>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            {isFirst ? "Day 0" : `+${timing}`}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function calculateWindowHours(start: string | null, end: string | null): number {
  if (!start || !end) return 8; // Default

  const [startHour, startMin] = start.split(":").map(Number);
  const [endHour, endMin] = end.split(":").map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  const diff = endMinutes - startMinutes;
  return Math.round(diff / 60);
}
