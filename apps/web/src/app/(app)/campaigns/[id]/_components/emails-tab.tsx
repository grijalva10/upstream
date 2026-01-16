"use client";

import { useState } from "react";
import { Clock, ChevronDown, ChevronUp, Copy, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
      {/* Merge tags help */}
      <MergeTagsHelper />

      {/* Email cards */}
      <div className="space-y-4">
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
    </div>
  );
}

function MergeTagsHelper() {
  const [copied, setCopied] = useState<string | null>(null);

  const tags = [
    { tag: "{{first_name}}", label: "First Name" },
    { tag: "{{company_name}}", label: "Company" },
    { tag: "{{property_address}}", label: "Property" },
    { tag: "{{market}}", label: "Market" },
  ];

  const copyTag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setCopied(tag);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 text-amber-500" />
        <span>Merge tags:</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map(({ tag, label }) => (
          <Tooltip key={tag}>
            <TooltipTrigger asChild>
              <button
                onClick={() => copyTag(tag)}
                className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-mono bg-background rounded border hover:bg-muted transition-colors"
              >
                {tag}
                {copied === tag ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Click to copy - {label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
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
  const [isExpanded, setIsExpanded] = useState(number === 1);

  const timingLabel =
    number === 1
      ? "Sent immediately after enrollment"
      : `Sent ${delayDays ?? 0} days after previous email`;

  const hasContent = subject || body;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors text-left"
      >
        {/* Step number */}
        <div className="flex-shrink-0">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary text-sm font-semibold">
            {number}
          </div>
        </div>

        {/* Title and timing */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">Email {number}</h3>
            {!hasContent && (
              <Badge variant="outline" className="text-xs">
                Empty
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Clock className="h-3 w-3" />
            {timingLabel}
          </p>
        </div>

        {/* Subject preview (when collapsed) */}
        {!isExpanded && subject && (
          <p className="hidden md:block flex-shrink-0 max-w-[200px] text-sm text-muted-foreground truncate">
            {subject}
          </p>
        )}

        {/* Edit button */}
        {isEditable && (
          <Button
            size="sm"
            variant="ghost"
            className="flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              // Edit functionality would go here
            }}
            disabled
          >
            Edit
          </Button>
        )}

        {/* Expand/collapse icon */}
        <div className="flex-shrink-0 text-muted-foreground">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </button>

      {/* Content - expandable */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          <Separator />

          {/* Subject line */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Subject Line
            </label>
            <div className="p-3 rounded-lg bg-muted/30 border border-transparent">
              {subject ? (
                <p className="text-sm">{subject}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No subject set</p>
              )}
            </div>
          </div>

          {/* Email body */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Message Body
            </label>
            <div className="p-4 rounded-lg bg-muted/30 border border-transparent max-h-80 overflow-y-auto">
              {body ? (
                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                  {body}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground italic">No body content set</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
