"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Play, Pause, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CampaignActionsProps {
  campaignId: string;
  status: string;
  enrollmentCount: number;
}

export function CampaignActions({ campaignId, status, enrollmentCount }: CampaignActionsProps) {
  const router = useRouter();
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [enrollResult, setEnrollResult] = useState<string | null>(null);

  const handleEnroll = async () => {
    setIsEnrolling(true);
    setEnrollResult(null);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/enroll`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setEnrollResult(`Error: ${data.error}`);
        return;
      }

      setEnrollResult(`Enrolled ${data.enrolled} contacts`);
      router.refresh();
    } catch {
      setEnrollResult("Failed to enroll contacts");
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdating(true);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        router.refresh();
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const isDraft = status === "draft";
  const isActive = status === "active";
  const isPaused = status === "paused";
  const canEnroll = isDraft;
  const canActivate = isDraft && enrollmentCount > 0;
  const canPause = isActive;
  const canResume = isPaused;

  return (
    <div className="flex items-center gap-2">
      {/* Enroll button - only in draft */}
      {canEnroll && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleEnroll}
          disabled={isEnrolling}
        >
          {isEnrolling ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Users className="h-4 w-4 mr-1.5" />
          )}
          {enrollmentCount > 0 ? "Enroll More" : "Enroll Contacts"}
        </Button>
      )}

      {/* Activate button - draft with enrollments */}
      {canActivate && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" disabled={isUpdating}>
              {isUpdating ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-1.5" />
              )}
              Activate
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Activate Campaign?</AlertDialogTitle>
              <AlertDialogDescription>
                This will mark the campaign as active. Email sending is not yet implemented,
                so no emails will actually be sent.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleStatusChange("active")}>
                Activate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Pause button - when active */}
      {canPause && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleStatusChange("paused")}
          disabled={isUpdating}
        >
          {isUpdating ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Pause className="h-4 w-4 mr-1.5" />
          )}
          Pause
        </Button>
      )}

      {/* Resume button - when paused */}
      {canResume && (
        <Button
          size="sm"
          onClick={() => handleStatusChange("active")}
          disabled={isUpdating}
        >
          {isUpdating ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-1.5" />
          )}
          Resume
        </Button>
      )}

      {/* Enroll result message */}
      {enrollResult && (
        <span className={`text-sm ${enrollResult.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
          {enrollResult}
        </span>
      )}
    </div>
  );
}
