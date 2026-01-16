"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Play, Pause, Loader2, CheckCircle, AlertCircle } from "lucide-react";
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
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleEnroll = async () => {
    setIsEnrolling(true);
    setNotification(null);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/enroll`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        showNotification("error", data.error || "Failed to enroll contacts");
        return;
      }

      showNotification("success", `Successfully enrolled ${data.enrolled} contacts`);
      router.refresh();
    } catch {
      showNotification("error", "Failed to enroll contacts");
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
        showNotification(
          "success",
          newStatus === "active" ? "Campaign activated" : "Campaign paused"
        );
        router.refresh();
      } else {
        showNotification("error", "Failed to update campaign status");
      }
    } catch {
      showNotification("error", "Failed to update campaign status");
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
    <div className="flex flex-col items-end gap-2">
      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {/* Enroll button - only in draft */}
        {canEnroll && (
          <Button
            variant="outline"
            onClick={handleEnroll}
            disabled={isEnrolling}
            className="gap-2"
          >
            {isEnrolling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            {enrollmentCount > 0 ? "Enroll More" : "Enroll Contacts"}
          </Button>
        )}

        {/* Activate button - draft with enrollments */}
        {canActivate && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={isUpdating} className="gap-2">
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Activate Campaign
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Activate this campaign?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>
                    This will start the email sequence for all {enrollmentCount} enrolled contacts.
                  </p>
                  <p className="text-amber-600 dark:text-amber-400">
                    Note: Email sending is not yet implemented. No emails will actually be sent.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleStatusChange("active")}
                  className="gap-2"
                >
                  <Play className="h-4 w-4" />
                  Activate
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Pause button - when active */}
        {canPause && (
          <Button
            variant="outline"
            onClick={() => handleStatusChange("paused")}
            disabled={isUpdating}
            className="gap-2"
          >
            {isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
            Pause
          </Button>
        )}

        {/* Resume button - when paused */}
        {canResume && (
          <Button
            onClick={() => handleStatusChange("active")}
            disabled={isUpdating}
            className="gap-2"
          >
            {isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Resume
          </Button>
        )}
      </div>

      {/* Notification toast */}
      {notification && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm animate-in fade-in slide-in-from-top-2 ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {notification.message}
        </div>
      )}
    </div>
  );
}
