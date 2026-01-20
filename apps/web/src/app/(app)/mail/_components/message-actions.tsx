"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Archive,
  Ban,
  Building2,
  CheckCircle,
  FileCheck,
  FileEdit,
  Loader2,
  MailX,
  Phone,
  Reply,
  Search,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type InboxMessage,
  type Action,
  type Classification,
  CLASSIFICATIONS,
  ACTIONS,
  getAvailableActions,
} from "@/lib/inbox/schemas";
import { useAISheet } from "@/components/ai-sheet";
import { takeAction } from "../actions";

// =============================================================================
// Types
// =============================================================================

interface MessageActionsProps {
  message: InboxMessage;
  onReply: () => void;
  onOptimisticUpdate?: (id: string, updates: Partial<InboxMessage>) => void;
}

// =============================================================================
// Icons & Styling
// =============================================================================

const actionIcons: Record<Action, React.ElementType> = {
  create_deal: Building2,
  schedule_call: Phone,
  create_search: Search,
  confirm_dnc: Ban,
  confirm_bounce: MailX,
  archive: Archive,
  reply: Reply,
  mark_reviewed: CheckCircle,
  approve_draft: FileCheck,
  edit_draft: FileEdit,
  create_contact: UserPlus,
};

const actionStyles: Partial<Record<Action, {
  variant: "default" | "outline" | "destructive" | "secondary" | "ghost";
  className?: string;
}>> = {
  create_deal: { variant: "default", className: "bg-green-600 hover:bg-green-700" },
  schedule_call: { variant: "default", className: "bg-blue-600 hover:bg-blue-700" },
  reply: { variant: "outline" },
  confirm_dnc: { variant: "destructive" },
  confirm_bounce: { variant: "destructive" },
  archive: { variant: "secondary" },
  mark_reviewed: { variant: "secondary" },
  create_contact: { variant: "outline" },
  create_search: { variant: "outline" },
};

// Primary actions that should be highlighted
const primaryActions: Action[] = ["create_deal", "schedule_call", "reply"];

// =============================================================================
// Component
// =============================================================================

export function MessageActions({
  message,
  onReply,
  onOptimisticUpdate,
}: MessageActionsProps) {
  const router = useRouter();
  const { open: openAISheet } = useAISheet();
  const [loadingAction, setLoadingAction] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const classification = message.classification as Classification | null;

  function handleAskAI() {
    openAISheet({
      type: "email",
      id: message.id,
      data: {
        from_name: message.from_name,
        from_email: message.from_email,
        subject: message.subject,
        body: message.body_text || message.body_html,
        received_at: message.received_at,
        classification: message.classification,
        matched_contact_id: message.matched_contact_id,
        matched_property_id: message.matched_property_id,
      },
    });
  }

  // Get available actions based on classification and linked entities
  const availableActions = getAvailableActions(
    classification,
    !!message.matched_property_id,
    !!message.matched_contact_id,
    !!message.draft_id
  ).filter(action => action !== "approve_draft" && action !== "edit_draft"); // Draft actions handled in mail-display

  // If no classification and no actions, don't render
  if (!classification && availableActions.length === 0) {
    return null;
  }

  async function handleAction(action: Action) {
    if (action === "reply") {
      onReply();
      return;
    }

    setLoadingAction(action);
    setError(null);

    startTransition(async () => {
      // Optimistic update
      if (onOptimisticUpdate) {
        onOptimisticUpdate(message.id, { status: "actioned" });
      }

      const result = await takeAction(message.id, action);

      if (!result.success) {
        setError(result.error);
        // Revert optimistic update on error
        if (onOptimisticUpdate) {
          onOptimisticUpdate(message.id, { status: message.status });
        }
        setLoadingAction(null);
        return;
      }

      // Navigate to created entity if applicable
      if (result.data?.createdId && action === "create_deal") {
        router.push(`/pipeline/${result.data.createdId}`);
      }

      setLoadingAction(null);
    });
  }

  const isActioned = message.status === "actioned";
  const classConfig = classification ? CLASSIFICATIONS[classification] : null;

  // Separate primary and secondary actions
  const actions = availableActions.filter(a => a !== "reply");
  const hasReply = (classConfig?.actions as readonly string[])?.includes("reply");

  // Find primary action (first one in primaryActions list that's available)
  const primaryAction = actions.find(a => primaryActions.includes(a));
  const secondaryActions = actions.filter(a => a !== primaryAction);

  // Check for missing data warnings
  const missingPropertyWarning =
    (classConfig?.actions as readonly string[])?.includes("create_deal") && !message.matched_property_id;
  const missingContactWarning =
    (classConfig?.actions as readonly string[])?.includes("schedule_call") && !message.matched_contact_id;

  return (
    <div className="space-y-3">
      {/* Success indicator */}
      {isActioned && message.action_taken && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-sm text-green-700 dark:text-green-300">
            Action completed: {message.action_taken.replace(/_/g, " ")}
          </span>
        </div>
      )}

      {/* Error indicator */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {/* AI Assistant button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAskAI}
              className="h-8"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Ask AI
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Open AI assistant with this email context
          </TooltipContent>
        </Tooltip>

        {/* Reply button - always first if available */}
        {hasReply && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReply}
            disabled={isActioned || isPending}
            className="h-8"
          >
            <Reply className="h-3.5 w-3.5 mr-1.5" />
            Reply
          </Button>
        )}

        {/* Primary action */}
        {primaryAction && (
          <ActionButton
            action={primaryAction}
            isLoading={loadingAction === primaryAction}
            isDisabled={isActioned || isPending}
            onClick={() => handleAction(primaryAction)}
            isPrimary
          />
        )}

        {/* Secondary actions */}
        {secondaryActions.map((action) => (
          <ActionButton
            key={action}
            action={action}
            isLoading={loadingAction === action}
            isDisabled={isActioned || isPending}
            onClick={() => handleAction(action)}
          />
        ))}
      </div>

      {/* Warnings for missing data */}
      {(missingPropertyWarning || missingContactWarning) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {missingPropertyWarning && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              No property linked - cannot create deal
            </p>
          )}
          {missingContactWarning && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              No contact linked - cannot schedule call
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Action Button Sub-component
// =============================================================================

function ActionButton({
  action,
  isLoading,
  isDisabled,
  onClick,
  isPrimary = false,
}: {
  action: Action;
  isLoading: boolean;
  isDisabled: boolean;
  onClick: () => void;
  isPrimary?: boolean;
}) {
  const Icon = actionIcons[action];
  const config = ACTIONS[action];
  const style = actionStyles[action] || { variant: "outline" as const };

  const button = (
    <Button
      variant={style.variant}
      size="sm"
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        "h-8",
        style.className,
        isPrimary && !style.className && "font-medium"
      )}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
      ) : (
        <Icon className="h-3.5 w-3.5 mr-1.5" />
      )}
      {config.label}
    </Button>
  );

  // Add tooltip for destructive actions
  if (style.variant === "destructive") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>
          {action === "confirm_dnc" && "Add to Do Not Contact list permanently"}
          {action === "confirm_bounce" && "Mark email as bounced and exclude permanently"}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
