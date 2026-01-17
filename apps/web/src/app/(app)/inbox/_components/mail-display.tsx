"use client";

import { useState, useTransition, useMemo } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  Archive,
  Bot,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileEdit,
  Loader2,
  MapPin,
  MoreHorizontal,
  Pencil,
  Send,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  type InboxMessage,
  type Classification,
  CLASSIFICATIONS,
} from "@/lib/inbox/schemas";
import { ConfidenceScore } from "@/components/ui/confidence-score";
import { MessageActions } from "./message-actions";
import { QuickReplyDialog } from "./quick-reply-dialog";
import { reclassifyMessage, approveDraft, editDraft } from "../actions";

// =============================================================================
// Types
// =============================================================================

interface MailDisplayProps {
  message: InboxMessage | null;
  onOptimisticUpdate?: (id: string, updates: Partial<InboxMessage>) => void;
}

// =============================================================================
// Constants
// =============================================================================

const classificationBorderColors: Record<string, string> = {
  green: "border-l-green-500",
  blue: "border-l-blue-500",
  yellow: "border-l-amber-500",
  orange: "border-l-orange-500",
  red: "border-l-red-500",
  gray: "border-l-gray-400",
  purple: "border-l-purple-500",
};

const classificationBgColors: Record<string, string> = {
  green: "bg-green-500/5",
  blue: "bg-blue-500/5",
  yellow: "bg-amber-500/5",
  orange: "bg-orange-500/5",
  red: "bg-red-500/5",
  gray: "bg-gray-500/5",
  purple: "bg-purple-500/5",
};

const classificationTextColors: Record<string, string> = {
  green: "text-green-600 dark:text-green-400",
  blue: "text-blue-600 dark:text-blue-400",
  yellow: "text-amber-600 dark:text-amber-400",
  orange: "text-orange-600 dark:text-orange-400",
  red: "text-red-600 dark:text-red-400",
  gray: "text-gray-600 dark:text-gray-400",
  purple: "text-purple-600 dark:text-purple-400",
};

// =============================================================================
// Empty State
// =============================================================================

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center bg-muted/20">
      <div className="text-center space-y-2">
        <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Send className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          No message selected
        </p>
        <p className="text-xs text-muted-foreground/70">
          Select a message from the list to view details
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// Sub-Components
// =============================================================================

function SenderAvatar({ name, email }: { name?: string | null; email: string }) {
  const initials = useMemo(() => {
    if (name) {
      const parts = name.split(" ");
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  }, [name, email]);

  return (
    <Avatar className="h-10 w-10 border">
      <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

function LinkedEntityChip({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted transition-colors text-xs">
      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium truncate max-w-[150px]">{value}</span>
      {href && <ExternalLink className="h-2.5 w-2.5 text-muted-foreground shrink-0" />}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="hover:no-underline">
        {content}
      </a>
    );
  }

  return content;
}

function ClassificationHeader({
  classification,
  confidence,
  reasoning,
  isLowConfidence,
  autoHandled,
  onReclassify,
  isPending,
}: {
  classification: Classification | null;
  confidence: number | null;
  reasoning: string | null;
  isLowConfidence: boolean;
  autoHandled: boolean;
  onReclassify: (c: Classification) => void;
  isPending: boolean;
}) {
  const [showReasoning, setShowReasoning] = useState(false);
  const config = classification ? CLASSIFICATIONS[classification] : CLASSIFICATIONS.unclear;
  const color = config.color;

  const classificationGroups = {
    hot: Object.entries(CLASSIFICATIONS).filter(([, c]) => c.group === "hot"),
    action: Object.entries(CLASSIFICATIONS).filter(([, c]) => c.group === "action"),
    redirect: Object.entries(CLASSIFICATIONS).filter(([, c]) => c.group === "redirect"),
    closed: Object.entries(CLASSIFICATIONS).filter(([, c]) => c.group === "closed"),
  };

  return (
    <div
      className={cn(
        "border-l-4 rounded-r-lg px-4 py-3 transition-colors",
        classificationBorderColors[color],
        classificationBgColors[color]
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className={cn("h-4 w-4", classificationTextColors[color])} />
            <span className={cn("font-semibold text-sm", classificationTextColors[color])}>
              {config.label}
            </span>
          </div>

          {confidence != null && (
            <ConfidenceScore score={confidence} variant="dot" showLabel size="sm" />
          )}

          {isLowConfidence && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20">
                  <AlertTriangle className="h-3 w-3" />
                  Review
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Low confidence classification. Please verify and reclassify if needed.
              </TooltipContent>
            </Tooltip>
          )}

          {autoHandled && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="gap-1">
                  <Bot className="h-3 w-3" />
                  Auto
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                This message was automatically handled by AI
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              className="h-7 px-2 text-muted-foreground hover:text-foreground shrink-0"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <span className="text-xs mr-1">Reclassify</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {/* Hot Leads */}
            <div className="px-2 py-1.5 text-xs font-semibold text-green-600">
              Hot Leads
            </div>
            {classificationGroups.hot.map(([key, cfg]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => onReclassify(key as Classification)}
                disabled={classification === key}
              >
                <span className="mr-2 h-2 w-2 rounded-full bg-green-500" />
                {cfg.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />

            {/* Action Required */}
            <div className="px-2 py-1.5 text-xs font-semibold text-amber-600">
              Action Required
            </div>
            {classificationGroups.action.map(([key, cfg]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => onReclassify(key as Classification)}
                disabled={classification === key}
              >
                <span className={cn("mr-2 h-2 w-2 rounded-full", `bg-${cfg.color}-500`)} />
                {cfg.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />

            {/* Redirect */}
            <div className="px-2 py-1.5 text-xs font-semibold text-orange-600">
              Redirect
            </div>
            {classificationGroups.redirect.map(([key, cfg]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => onReclassify(key as Classification)}
                disabled={classification === key}
              >
                <span className={cn("mr-2 h-2 w-2 rounded-full", `bg-${cfg.color}-500`)} />
                {cfg.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />

            {/* Closed */}
            <div className="px-2 py-1.5 text-xs font-semibold text-gray-600">
              Closed
            </div>
            {classificationGroups.closed.map(([key, cfg]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => onReclassify(key as Classification)}
                disabled={classification === key}
              >
                <span className={cn("mr-2 h-2 w-2 rounded-full", `bg-${cfg.color}-500`)} />
                {cfg.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {reasoning && (
        <Collapsible open={showReasoning} onOpenChange={setShowReasoning}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
              {showReasoning ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              AI reasoning
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed pl-4 border-l-2 border-muted">
              {reasoning}
            </p>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function DraftSection({
  draftSubject,
  draftBody,
  draftStatus,
  isPending,
  onApprove,
  onSave,
}: {
  draftSubject: string | null;
  draftBody: string | null;
  draftStatus: string | null;
  isPending: boolean;
  onApprove: () => void;
  onSave: (subject: string, body: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [subject, setSubject] = useState(draftSubject || "");
  const [body, setBody] = useState(draftBody || "");

  const handleSave = () => {
    onSave(subject, body);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setSubject(draftSubject || "");
    setBody(draftBody || "");
    setIsEditing(false);
  };

  return (
    <div className="border rounded-lg border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 overflow-hidden">
      {/* Draft Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-blue-200/50 dark:border-blue-800/50 bg-blue-100/30 dark:bg-blue-900/20">
        <div className="flex items-center gap-2">
          <FileEdit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            Draft Reply
          </span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0",
              draftStatus === "pending" && "border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-900/20",
              draftStatus === "approved" && "border-green-300 text-green-600 bg-green-50 dark:bg-green-900/20"
            )}
          >
            {draftStatus}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          {!isEditing ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                disabled={isPending}
                className="h-7 text-xs"
              >
                <Pencil className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button
                size="sm"
                onClick={onApprove}
                disabled={isPending || draftStatus === "approved"}
                className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
              >
                {isPending ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Check className="h-3 w-3 mr-1" />
                )}
                Approve
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={isPending}
                className="h-7 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isPending}
                className="h-7 text-xs"
              >
                {isPending ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Check className="h-3 w-3 mr-1" />
                )}
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Draft Content */}
      <div className="p-4 space-y-3">
        {isEditing ? (
          <>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1.5 block">
                Subject
              </label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-8 text-sm bg-white dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1.5 block">
                Message
              </label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                className="resize-none text-sm bg-white dark:bg-gray-900"
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                Subject
              </span>
              <p className="text-sm mt-0.5">{draftSubject}</p>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                Message
              </span>
              <p className="text-sm mt-0.5 text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {draftBody}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EmailBody({
  bodyHtml,
  bodyText,
}: {
  bodyHtml: string | null | undefined;
  bodyText: string | null | undefined;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="px-5 py-4">
        {bodyHtml ? (
          <div
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
            className="prose prose-sm max-w-none dark:prose-invert
                       prose-p:my-2 prose-p:leading-relaxed
                       prose-headings:font-semibold
                       prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                       prose-blockquote:border-l-muted-foreground/30 prose-blockquote:text-muted-foreground
                       prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                       prose-pre:bg-muted prose-pre:border
                       [&_img]:max-w-full [&_img]:h-auto
                       [&_table]:text-sm [&_table]:border-collapse
                       [&_td]:border [&_td]:border-muted [&_td]:p-2
                       [&_th]:border [&_th]:border-muted [&_th]:p-2 [&_th]:bg-muted"
          />
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
            {bodyText}
          </pre>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function MailDisplay({ message, onOptimisticUpdate }: MailDisplayProps) {
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!message) {
    return <EmptyState />;
  }

  // Handlers
  async function handleReclassify(newClassification: Classification) {
    if (!message) return;

    startTransition(async () => {
      if (onOptimisticUpdate) {
        onOptimisticUpdate(message.id, {
          classification: newClassification,
          status: "reviewed",
        });
      }

      const result = await reclassifyMessage(message.id, newClassification);

      if (!result.success) {
        if (onOptimisticUpdate) {
          onOptimisticUpdate(message.id, {
            classification: message.classification,
            status: message.status,
          });
        }
      }
    });
  }

  async function handleApproveDraft() {
    if (!message || !message.draft_id) return;
    startTransition(async () => {
      const result = await approveDraft(message.draft_id!);
      if (!result.success) {
        console.error("Failed to approve draft:", result.error);
      }
    });
  }

  async function handleSaveDraft(subject: string, body: string) {
    if (!message || !message.draft_id) return;
    startTransition(async () => {
      const result = await editDraft(message.draft_id!, subject, body);
      if (!result.success) {
        console.error("Failed to save draft:", result.error);
      }
    });
  }

  // Computed values
  const formattedDate = message.received_at
    ? format(new Date(message.received_at), "EEE, MMM d, yyyy 'at' h:mm a")
    : "";

  const lowConfidence =
    message.classification_confidence != null && message.classification_confidence < 0.7;

  const contactName = message.contact_name || null;
  const companyName = message.company_name || null;
  const propertyAddress = message.property_address || message.property_name || null;
  const hasDraft = !!message.draft_id;
  const hasLinkedEntities = contactName || companyName || propertyAddress;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0 border-b bg-background">
        {/* Classification Banner */}
        {message.classification && (
          <ClassificationHeader
            classification={message.classification as Classification}
            confidence={message.classification_confidence ?? null}
            reasoning={message.classification_reasoning ?? null}
            isLowConfidence={lowConfidence}
            autoHandled={!!message.auto_handled}
            onReclassify={handleReclassify}
            isPending={isPending}
          />
        )}

        {/* Email Header */}
        <div className="px-6 py-4">
          <div className="flex items-start gap-3">
            <SenderAvatar
              name={message.from_name}
              email={message.from_email}
            />

            <div className="flex-1 min-w-0">
              {/* Subject */}
              <h1 className="text-base font-semibold text-foreground leading-tight mb-1">
                {message.subject || "(No subject)"}
              </h1>

              {/* Sender line */}
              <div className="flex items-baseline gap-1.5 text-sm">
                <span className="font-medium text-foreground">
                  {message.from_name || message.from_email}
                </span>
                {message.from_name && (
                  <span className="text-muted-foreground text-xs">
                    &lt;{message.from_email}&gt;
                  </span>
                )}
              </div>

              {/* To + Date line */}
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                {message.to_emails && message.to_emails.length > 0 && (
                  <>
                    <span>to {message.to_emails[0]}{message.to_emails.length > 1 && ` +${message.to_emails.length - 1}`}</span>
                    <span>·</span>
                  </>
                )}
                <span>{formattedDate}</span>
              </div>
            </div>

            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Linked Entities */}
          {hasLinkedEntities && (
            <div className="flex flex-wrap gap-1.5 mt-3 -mb-1">
              {contactName && (
                <LinkedEntityChip icon={User} label="Contact" value={contactName} />
              )}
              {companyName && (
                <LinkedEntityChip icon={Building2} label="Company" value={companyName} />
              )}
              {propertyAddress && (
                <LinkedEntityChip icon={MapPin} label="Property" value={propertyAddress} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-4 space-y-4">
          {/* Draft Section */}
          {hasDraft && (
            <DraftSection
              draftSubject={message.draft_subject ?? null}
              draftBody={message.draft_body ?? null}
              draftStatus={message.draft_status ?? null}
              isPending={isPending}
              onApprove={handleApproveDraft}
              onSave={handleSaveDraft}
            />
          )}

          {/* Action Buttons */}
          <MessageActions
            message={message}
            onReply={() => setShowReplyDialog(true)}
            onOptimisticUpdate={onOptimisticUpdate}
          />

          <Separator />

          {/* Email Body */}
          <EmailBody
            bodyHtml={message.body_html}
            bodyText={message.body_text}
          />
        </div>
      </div>

      {/* Reply Dialog */}
      <QuickReplyDialog
        message={message}
        open={showReplyDialog}
        onOpenChange={setShowReplyDialog}
      />
    </div>
  );
}
