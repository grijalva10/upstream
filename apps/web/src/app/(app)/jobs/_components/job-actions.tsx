"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MoreHorizontal,
  Eye,
  RotateCcw,
  XCircle,
  Copy,
  Check,
} from "lucide-react";
import type { Job } from "./jobs-data-table";

interface JobActionsProps {
  job: Job;
}

export function JobActions({ job }: JobActionsProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(job.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetry = async () => {
    // TODO: Implement retry via API
    console.log("Retry job:", job.id);
  };

  const handleCancel = async () => {
    // TODO: Implement cancel via API
    console.log("Cancel job:", job.id);
  };

  const canRetry = job.status === "failed";
  const canCancel = job.status === "pending" || job.status === "scheduled";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowDetails(true)}>
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyId}>
            {copied ? (
              <Check className="h-4 w-4 mr-2 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            Copy ID
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleRetry}
            disabled={!canRetry}
            className={canRetry ? "" : "opacity-50"}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Retry
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleCancel}
            disabled={!canCancel}
            className={`${canCancel ? "text-red-600" : "opacity-50"}`}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Cancel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Job Details</DialogTitle>
            <DialogDescription>
              Full details for job {job.id.slice(0, 8)}...
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Status row */}
            <div className="flex items-center gap-4">
              <Badge
                variant={
                  job.status === "sent"
                    ? "outline"
                    : job.status === "failed"
                    ? "destructive"
                    : "secondary"
                }
              >
                {job.status}
              </Badge>
              <Badge variant="outline">{job.source}</Badge>
              <span className="text-sm text-muted-foreground">
                Priority: {job.priority}
              </span>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-muted-foreground">ID</label>
                <p className="font-mono text-xs break-all">{job.id}</p>
              </div>
              <div>
                <label className="text-muted-foreground">Type</label>
                <p>{job.job_type.replace(/_/g, " ")}</p>
              </div>
              <div>
                <label className="text-muted-foreground">To</label>
                <p>{job.to_email}</p>
              </div>
              <div>
                <label className="text-muted-foreground">Attempts</label>
                <p>
                  {job.attempts} / {job.max_attempts}
                </p>
              </div>
              <div>
                <label className="text-muted-foreground">Created</label>
                <p>{new Date(job.created_at).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-muted-foreground">Scheduled For</label>
                <p>{new Date(job.scheduled_for).toLocaleString()}</p>
              </div>
              {job.sent_at && (
                <div>
                  <label className="text-muted-foreground">Sent At</label>
                  <p>{new Date(job.sent_at).toLocaleString()}</p>
                </div>
              )}
              {job.sequence_id && (
                <div>
                  <label className="text-muted-foreground">Sequence</label>
                  <p className="font-mono text-xs">{job.sequence_id}</p>
                </div>
              )}
            </div>

            {/* Subject */}
            <div>
              <label className="text-muted-foreground text-sm">Subject</label>
              <p className="text-sm mt-1 p-2 bg-muted rounded">{job.subject}</p>
            </div>

            {/* Error */}
            {job.last_error && (
              <div>
                <label className="text-muted-foreground text-sm">
                  Last Error
                </label>
                <pre className="text-xs mt-1 p-2 bg-red-50 text-red-800 rounded overflow-auto max-h-32">
                  {job.last_error}
                </pre>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyId}
              >
                {copied ? (
                  <Check className="h-4 w-4 mr-1" />
                ) : (
                  <Copy className="h-4 w-4 mr-1" />
                )}
                Copy ID
              </Button>
              {canRetry && (
                <Button variant="outline" size="sm" onClick={handleRetry}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Retry
                </Button>
              )}
              {canCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  className="text-red-600"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
