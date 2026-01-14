"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ApprovalActionsProps {
  criteriaId: string;
}

export function ApprovalActions({ criteriaId }: ApprovalActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const handleApprove = async () => {
    setLoading("approve");
    setError(null);

    try {
      const response = await fetch(`/api/criteria/${criteriaId}/approve`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to approve criteria");
        setLoading(null);
        return;
      }

      router.refresh();
    } catch {
      setError("Failed to connect to API");
      setLoading(null);
    }
  };

  const handleReject = async () => {
    setLoading("reject");
    setError(null);

    try {
      const response = await fetch(`/api/criteria/${criteriaId}/reject`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to reject criteria");
        setLoading(null);
        return;
      }

      setRejectDialogOpen(false);
      router.refresh();
    } catch {
      setError("Failed to connect to API");
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-sm text-red-500 mr-2">{error}</span>
      )}

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" disabled={loading !== null}>
            <XCircle className="h-4 w-4 mr-2" />
            Reject
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Criteria?</DialogTitle>
            <DialogDescription>
              This will mark the criteria as rejected and no extraction will be performed.
              You can modify and resubmit the criteria later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={loading === "reject"}
            >
              {loading === "reject" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                "Reject"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button onClick={handleApprove} disabled={loading !== null}>
        {loading === "approve" ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Approving...
          </>
        ) : (
          <>
            <Play className="h-4 w-4 mr-2" />
            Approve & Run Extraction
          </>
        )}
      </Button>
    </div>
  );
}
