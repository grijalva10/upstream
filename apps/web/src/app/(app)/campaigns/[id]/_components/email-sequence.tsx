"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Email {
  num: number;
  subject: string | null;
  body: string | null;
  delay: number | null;
}

interface EmailSequenceProps {
  emails: Email[];
}

export function EmailSequence({ emails }: EmailSequenceProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const toggle = (num: number) => {
    setExpanded(expanded === num ? null : num);
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden divide-y">
      {emails.map(({ num, subject, body, delay }) => {
        const isExpanded = expanded === num;
        const hasBody = body && body.trim().length > 0;

        return (
          <div key={num}>
            <button
              onClick={() => hasBody && toggle(num)}
              className={cn(
                "w-full flex items-center gap-4 p-4 text-left transition-colors",
                hasBody && "hover:bg-muted/20 cursor-pointer",
                !hasBody && "cursor-default"
              )}
            >
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-medium flex-shrink-0">
                {num}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {subject || <span className="text-muted-foreground italic">No subject</span>}
                </p>
                {!hasBody && (
                  <p className="text-xs text-muted-foreground mt-0.5">No body content</p>
                )}
              </div>
              <span className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                <Clock className="h-3 w-3" />
                {delay === null ? "Immediate" : `+${delay} days`}
              </span>
              {hasBody && (
                <div className="flex-shrink-0 text-muted-foreground">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </div>
              )}
            </button>
            {isExpanded && hasBody && (
              <div className="px-4 pb-4 pt-0">
                <div className="ml-12 p-4 rounded-lg bg-muted/30 text-sm whitespace-pre-wrap">
                  {body}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
