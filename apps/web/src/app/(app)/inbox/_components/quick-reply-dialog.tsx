"use client";

import { useState, useTransition } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type InboxMessage } from "@/lib/inbox/schemas";
import { queueReply } from "../actions";

// =============================================================================
// Types
// =============================================================================

interface QuickReplyDialogProps {
  message: InboxMessage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function QuickReplyDialog({
  message,
  open,
  onOpenChange,
  onSuccess,
}: QuickReplyDialogProps) {
  const [subject, setSubject] = useState(`Re: ${message.subject || ""}`);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!body.trim()) return;

    setError(null);

    startTransition(async () => {
      const result = await queueReply(message.id, subject, body);

      if (!result.success) {
        setError(result.error);
        return;
      }

      setBody("");
      onOpenChange(false);
      onSuccess?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Reply to Message</DialogTitle>
          <DialogDescription>
            Your reply will be queued for approval before sending.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* To field (read-only) */}
          <div className="space-y-2">
            <Label>To</Label>
            <Input
              value={message.from_name ? `${message.from_name} <${message.from_email}>` : message.from_email}
              disabled
              className="bg-muted"
              aria-readonly="true"
            />
          </div>

          {/* Subject field */}
          <div className="space-y-2">
            <Label htmlFor="reply-subject">Subject</Label>
            <Input
              id="reply-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
            />
          </div>

          {/* Body field */}
          <div className="space-y-2">
            <Label htmlFor="reply-body">Message</Label>
            <Textarea
              id="reply-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your reply..."
              className="min-h-[150px] resize-none"
            />
          </div>

          {/* Original message preview */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">Original Message</Label>
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground max-h-[100px] overflow-y-auto">
              <p className="font-medium mb-1">
                From: {message.from_name || message.from_email}
              </p>
              <p className="whitespace-pre-wrap">
                {message.body_text?.slice(0, 500)}
                {(message.body_text?.length || 0) > 500 ? "..." : ""}
              </p>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!body.trim() || isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Queue for Approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
