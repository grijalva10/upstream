"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import {
  Archive,
  MapPin,
  MoreVertical,
  Sparkles,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { ClassificationBadge } from "@/components/classification-badge";
import {
  type InboxMessage,
  type Classification,
  CLASSIFICATIONS,
} from "@/lib/inbox/schemas";
import { ConfidenceIndicator } from "./confidence-indicator";
import { MessageActions } from "./message-actions";
import { QuickReplyDialog } from "./quick-reply-dialog";
import { reclassifyMessage } from "../actions";

// =============================================================================
// Types
// =============================================================================

interface MailDisplayProps {
  message: InboxMessage | null;
  onOptimisticUpdate?: (id: string, updates: Partial<InboxMessage>) => void;
}

// =============================================================================
// Empty State
// =============================================================================

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center bg-muted/30">
      <div className="text-center text-muted-foreground">
        <p className="text-lg font-medium">No message selected</p>
        <p className="text-sm">Select a message to view its contents</p>
      </div>
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

export function MailDisplay({ message, onOptimisticUpdate }: MailDisplayProps) {
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!message) {
    return <EmptyState />;
  }

  async function handleReclassify(newClassification: Classification) {
    if (!message) return;

    startTransition(async () => {
      // Optimistic update
      if (onOptimisticUpdate) {
        onOptimisticUpdate(message.id, {
          classification: newClassification,
          status: "reviewed",
        });
      }

      const result = await reclassifyMessage(message.id, newClassification);

      if (!result.success) {
        // Revert on error
        if (onOptimisticUpdate) {
          onOptimisticUpdate(message.id, {
            classification: message.classification,
            status: message.status,
          });
        }
      }
    });
  }

  const formattedDate = message.received_at
    ? format(new Date(message.received_at), "PPpp")
    : "";

  const lowConfidence =
    message.classification_confidence !== null && message.classification_confidence < 0.7;

  const contactName = message.contact?.name || null;

  const propertyAddress = message.property?.address || message.property?.property_name || null;

  // Group classifications for the menu
  const classificationGroups = {
    hot: Object.entries(CLASSIFICATIONS).filter(([, c]) => c.group === "hot"),
    action: Object.entries(CLASSIFICATIONS).filter(([, c]) => c.group === "action"),
    closed: Object.entries(CLASSIFICATIONS).filter(([, c]) => c.group === "closed"),
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="p-6">
          {/* Email Header */}
          <div className="mb-6">
            <div className="flex items-start justify-between mb-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">
                  {message.subject || "(No subject)"}
                </h2>
                <div className="text-sm text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">From:</span>{" "}
                    {message.from_name ? `${message.from_name} <${message.from_email}>` : message.from_email}
                  </p>
                  {message.to_email && (
                    <p>
                      <span className="font-medium text-foreground">To:</span>{" "}
                      {message.to_email}
                    </p>
                  )}
                  <p>
                    <span className="font-medium text-foreground">Date:</span>{" "}
                    {formattedDate}
                  </p>
                </div>
              </div>

              {/* Reclassify Menu */}
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      aria-label="Message options"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem disabled>
                      <Archive className="h-4 w-4 mr-2" />
                      Archive
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />

                    {/* Hot Leads */}
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Hot Leads
                    </div>
                    {classificationGroups.hot.map(([key, config]) => (
                      <DropdownMenuItem
                        key={key}
                        onClick={() => handleReclassify(key as Classification)}
                        disabled={message.classification === key}
                      >
                        <span className={cn(
                          "mr-2 h-2 w-2 rounded-full",
                          `bg-${config.color}-500`
                        )} />
                        {config.label}
                      </DropdownMenuItem>
                    ))}

                    <DropdownMenuSeparator />

                    {/* Action Required */}
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Action Required
                    </div>
                    {classificationGroups.action.map(([key, config]) => (
                      <DropdownMenuItem
                        key={key}
                        onClick={() => handleReclassify(key as Classification)}
                        disabled={message.classification === key}
                      >
                        <span className={cn(
                          "mr-2 h-2 w-2 rounded-full",
                          `bg-${config.color}-500`
                        )} />
                        {config.label}
                      </DropdownMenuItem>
                    ))}

                    <DropdownMenuSeparator />

                    {/* Closed */}
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Closed
                    </div>
                    {classificationGroups.closed.map(([key, config]) => (
                      <DropdownMenuItem
                        key={key}
                        onClick={() => handleReclassify(key as Classification)}
                        disabled={message.classification === key}
                      >
                        <span className={cn(
                          "mr-2 h-2 w-2 rounded-full",
                          `bg-${config.color}-500`
                        )} />
                        {config.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Linked Entities */}
            {(contactName || propertyAddress) && (
              <Card className="mb-4">
                <CardContent className="py-3">
                  <div className="flex flex-wrap gap-4">
                    {contactName && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Contact:</span>
                        <span className="font-medium">{contactName}</span>
                      </div>
                    )}
                    {propertyAddress && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Property:</span>
                        <span className="font-medium">{propertyAddress}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Classification Card */}
            <Card className={cn("mb-4", lowConfidence && "border-amber-500/50")}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    <CardTitle className="text-sm font-medium">
                      AI Classification
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {message.classification && (
                      <ClassificationBadge type={message.classification} />
                    )}
                    {message.classification_confidence !== null && (
                      <ConfidenceIndicator
                        confidence={message.classification_confidence}
                        showPercentage
                      />
                    )}
                  </div>
                </div>
              </CardHeader>
              {(lowConfidence || message.classification_reasoning) && (
                <CardContent className="pt-0 pb-3">
                  {lowConfidence && (
                    <CardDescription className="text-amber-500 mb-2">
                      Low confidence classification. Please review and reclassify if needed.
                    </CardDescription>
                  )}
                  {message.classification_reasoning && (
                    <CardDescription className="text-muted-foreground">
                      {message.classification_reasoning}
                    </CardDescription>
                  )}
                </CardContent>
              )}
            </Card>

            {/* Action Buttons */}
            <MessageActions
              message={message}
              onReply={() => setShowReplyDialog(true)}
              onOptimisticUpdate={onOptimisticUpdate}
            />
          </div>

          <Separator className="my-4" />

          {/* Email Body */}
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {message.body_html ? (
              <div
                dangerouslySetInnerHTML={{ __html: message.body_html }}
                className="whitespace-pre-wrap"
              />
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-sm">
                {message.body_text}
              </pre>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Reply Dialog */}
      <QuickReplyDialog
        message={message}
        open={showReplyDialog}
        onOpenChange={setShowReplyDialog}
      />
    </div>
  );
}
