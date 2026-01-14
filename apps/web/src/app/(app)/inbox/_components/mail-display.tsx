"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Archive,
  CheckCircle,
  DollarSign,
  MoreVertical,
  Reply,
  Send,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClassificationBadge, type ClassificationType } from "@/components/classification-badge";
import { type Email, type ExtractedPricing } from "./use-mail";
import { ConfidenceIndicator } from "./confidence-indicator";

const CLASSIFICATION_OPTIONS: { value: ClassificationType; label: string }[] = [
  { value: "interested", label: "Interested" },
  { value: "pricing_given", label: "Pricing Given" },
  { value: "question", label: "Question" },
  { value: "referral", label: "Referral" },
  { value: "ooo", label: "Out of Office" },
  { value: "soft_pass", label: "Soft Pass" },
  { value: "hard_pass", label: "Hard Pass" },
  { value: "broker_redirect", label: "Broker Redirect" },
  { value: "bounce", label: "Bounce" },
  { value: "unclear", label: "Unclear" },
  { value: "stale_data", label: "Stale Data" },
];

interface PricingFieldProps {
  label: string;
  value: number | undefined;
  prefix?: string;
  suffix?: string;
}

function PricingField({ label, value, prefix = "$", suffix = "" }: PricingFieldProps): React.ReactElement | null {
  if (value === undefined) return null;

  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">
        {prefix}{value.toLocaleString()}{suffix}
      </p>
    </div>
  );
}

interface PricingCardProps {
  pricing: ExtractedPricing;
}

function PricingCard({ pricing }: PricingCardProps): React.ReactElement {
  return (
    <Card className="mb-4 border-green-500/50">
      <CardHeader className="py-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-green-500" />
          <CardTitle className="text-sm font-medium">Extracted Pricing</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <PricingField label="Asking Price" value={pricing.asking_price} />
          <PricingField label="NOI" value={pricing.noi} />
          <PricingField label="Cap Rate" value={pricing.cap_rate} prefix="" suffix="%" />
          <PricingField label="Price/SF" value={pricing.price_per_sf} />
        </div>
      </CardContent>
    </Card>
  );
}

interface MailDisplayProps {
  email: Email | null;
}

function EmptyState(): React.ReactElement {
  return (
    <div className="flex h-full items-center justify-center bg-muted/30">
      <div className="text-center text-muted-foreground">
        <p className="text-lg font-medium">No email selected</p>
        <p className="text-sm">Select an email to view its contents</p>
      </div>
    </div>
  );
}

export function MailDisplay({ email }: MailDisplayProps): React.ReactElement {
  const [replyText, setReplyText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQueued, setIsQueued] = useState(false);

  if (!email) {
    return <EmptyState />;
  }

  const emailId = email.id;
  const emailSubject = email.subject;

  async function handleReclassify(newClassification: ClassificationType): Promise<void> {
    const response = await fetch(`/api/inbox/${emailId}/reclassify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classification: newClassification }),
    });

    if (!response.ok) {
      console.error("Failed to reclassify");
      return;
    }

    window.location.reload();
  }

  async function handleQueueReply(): Promise<void> {
    if (!replyText.trim()) return;

    setIsSubmitting(true);
    const response = await fetch(`/api/inbox/${emailId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: replyText,
        subject: `Re: ${emailSubject || ""}`,
      }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      console.error("Failed to queue reply");
      return;
    }

    setReplyText("");
    setIsQueued(true);
  }

  const formattedDate = email.received_at
    ? format(new Date(email.received_at), "PPpp")
    : "";

  const showPricingCard =
    email.classification === "pricing_given" && email.extracted_pricing !== null;

  const needsReview =
    email.needs_human_review ||
    (email.classification_confidence !== null && email.classification_confidence < 0.7);

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="p-6">
          {/* Email Header */}
          <div className="mb-6">
            <div className="flex items-start justify-between mb-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">
                  {email.subject || "(No subject)"}
                </h2>
                <div className="text-sm text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">From:</span>{" "}
                    {email.from_name ? `${email.from_name} <${email.from_email}>` : email.from_email}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">To:</span>{" "}
                    {email.to_emails?.join(", ")}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Date:</span>{" "}
                    {formattedDate}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Archive className="h-4 w-4 mr-1" />
                  Archive
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark as reviewed
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {CLASSIFICATION_OPTIONS.map((option) => (
                      <DropdownMenuItem
                        key={option.value}
                        onClick={() => handleReclassify(option.value)}
                      >
                        Reclassify as {option.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Classification Card */}
            <Card className={cn("mb-4", needsReview && "border-amber-500/50")}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    <CardTitle className="text-sm font-medium">
                      AI Classification
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {email.classification && (
                      <ClassificationBadge type={email.classification} />
                    )}
                    {email.classification_confidence !== null && (
                      <ConfidenceIndicator
                        confidence={email.classification_confidence}
                        showPercentage
                      />
                    )}
                  </div>
                </div>
              </CardHeader>
              {needsReview && (
                <CardContent className="pt-0 pb-3">
                  <CardDescription className="text-amber-500">
                    Low confidence classification. Please review and reclassify if
                    needed.
                  </CardDescription>
                </CardContent>
              )}
            </Card>

            {showPricingCard && email.extracted_pricing && (
              <PricingCard pricing={email.extracted_pricing} />
            )}
          </div>

          <Separator className="my-4" />

          {/* Email Body */}
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {email.body_html ? (
              <div
                dangerouslySetInnerHTML={{ __html: email.body_html }}
                className="whitespace-pre-wrap"
              />
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-sm">
                {email.body_text}
              </pre>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Reply Section */}
      <div className="border-t p-4 bg-muted/30">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Reply className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Reply</span>
            {isQueued && (
              <span className="text-xs text-green-500 font-medium">
                Queued for approval
              </span>
            )}
          </div>
          <Textarea
            placeholder="Type your reply... (will be queued for approval)"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            className="min-h-[100px] resize-none"
          />
          <div className="flex justify-end">
            <Button
              onClick={handleQueueReply}
              disabled={!replyText.trim() || isSubmitting}
            >
              <Send className="h-4 w-4 mr-2" />
              {isSubmitting ? "Queueing..." : "Queue for Approval"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
