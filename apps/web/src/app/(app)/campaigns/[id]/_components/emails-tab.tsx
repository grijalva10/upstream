import { Mail, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CampaignWithSearch } from "../../_lib/types";
import { getCampaignEmails, canEdit } from "../../_lib/utils";

interface EmailsTabProps {
  campaign: CampaignWithSearch;
}

export function EmailsTab({ campaign }: EmailsTabProps) {
  const emails = getCampaignEmails(campaign);
  const isEditable = canEdit(campaign.status);

  return (
    <div className="space-y-6">
      <MergeTagsInfo />
      {emails.map((email) => (
        <EmailCard
          key={email.number}
          number={email.number}
          subject={email.subject}
          body={email.body}
          delayDays={email.delayDays}
          isEditable={isEditable}
        />
      ))}
    </div>
  );
}

function MergeTagsInfo() {
  const tags = [
    { tag: "{{first_name}}", description: "Contact's first name" },
    { tag: "{{company_name}}", description: "Contact's company" },
    { tag: "{{property_address}}", description: "Property address" },
    { tag: "{{market}}", description: "Property market/city" },
  ];

  return (
    <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
      <CardContent className="py-3 sm:py-4">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Merge Tags
            </p>
            <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 mt-1">
              Use these tags in your emails and they&apos;ll be replaced with contact data:
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.map(({ tag }) => (
                <code
                  key={tag}
                  className="text-xs bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded"
                >
                  {tag}
                </code>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface EmailCardProps {
  number: 1 | 2 | 3;
  subject: string | null;
  body: string | null;
  delayDays: number | null;
  isEditable: boolean;
}

function EmailCard({ number, subject, body, delayDays, isEditable }: EmailCardProps) {
  const delayLabel =
    number === 1
      ? "Sent immediately"
      : `Sent ${delayDays ?? 0} days after previous email`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-medium">
              {number}
            </span>
            <div>
              <CardTitle className="text-base">Email {number}</CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground">{delayLabel}</p>
            </div>
          </div>
          {isEditable && (
            <Button size="sm" variant="outline" disabled>
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-xs sm:text-sm font-medium text-muted-foreground">
            Subject
          </label>
          <div className="mt-1 p-2 sm:p-3 bg-muted/50 rounded-lg">
            <p className="text-sm sm:text-base">
              {subject || (
                <span className="text-muted-foreground italic">No subject set</span>
              )}
            </p>
          </div>
        </div>
        <div>
          <label className="text-xs sm:text-sm font-medium text-muted-foreground">
            Body
          </label>
          <div className="mt-1 p-2 sm:p-3 bg-muted/50 rounded-lg max-h-64 overflow-y-auto">
            {body ? (
              <pre className="text-xs sm:text-sm whitespace-pre-wrap font-sans">
                {body}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No body content set
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
