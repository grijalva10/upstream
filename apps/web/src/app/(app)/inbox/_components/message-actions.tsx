"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
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
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type InboxMessage,
  type Action,
  type Classification,
  CLASSIFICATIONS,
  ACTIONS,
  getAvailableActions,
} from "@/lib/inbox/schemas";
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
// Icons
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

const actionVariants: Partial<Record<Action, "default" | "outline" | "destructive">> = {
  confirm_dnc: "destructive",
  confirm_bounce: "destructive",
  archive: "outline",
  mark_reviewed: "outline",
  create_contact: "outline",
};

// =============================================================================
// Component
// =============================================================================

export function MessageActions({
  message,
  onReply,
  onOptimisticUpdate,
}: MessageActionsProps) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const classification = message.classification as Classification | null;

  // Get available actions based on classification and linked entities
  // Note: Use matched_property_id/matched_contact_id (from inbox_view)
  const availableActions = getAvailableActions(
    classification,
    !!message.matched_property_id,
    !!message.matched_contact_id,
    !!message.draft_id
  ).filter(action => action !== "reply" && action !== "approve_draft" && action !== "edit_draft"); // Draft actions handled in mail-display

  // If no classification and no actions, don't render
  if (!classification && availableActions.length === 0) {
    return null;
  }

  async function handleAction(action: Action) {
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

  return (
    <Card className="mb-4">
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium">Actions</CardTitle>
        {isActioned && message.action_taken && (
          <CardDescription className="text-green-600">
            Action taken: {message.action_taken.replace(/_/g, " ")}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        {error && (
          <p className="text-sm text-destructive mb-3" role="alert">{error}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {/* Reply button - always available unless actioned */}
          {(classConfig?.actions as readonly string[])?.includes("reply") && (
            <Button
              variant="outline"
              size="sm"
              onClick={onReply}
              disabled={isActioned || isPending}
              aria-label="Reply to message"
            >
              <Reply className="h-4 w-4 mr-1" />
              Reply
            </Button>
          )}

          {/* Action buttons from config */}
          {availableActions.map((action) => {
            const Icon = actionIcons[action];
            const variant = actionVariants[action] || "default";
            const config = ACTIONS[action];
            const isLoading = loadingAction === action;
            const isDisabled = isActioned || isPending;

            return (
              <Button
                key={action}
                variant={variant}
                size="sm"
                onClick={() => handleAction(action)}
                disabled={isDisabled}
                aria-label={config.label}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4 mr-1" />
                )}
                {config.label}
              </Button>
            );
          })}
        </div>

        {/* Show warnings for missing data */}
        {(classConfig?.actions as readonly string[])?.includes("create_deal") && !message.matched_property_id && (
          <p className="text-xs text-muted-foreground mt-2">
            No property linked - cannot create deal
          </p>
        )}
        {(classConfig?.actions as readonly string[])?.includes("schedule_call") && !message.matched_contact_id && (
          <p className="text-xs text-muted-foreground mt-2">
            No contact linked - cannot schedule call
          </p>
        )}
      </CardContent>
    </Card>
  );
}
