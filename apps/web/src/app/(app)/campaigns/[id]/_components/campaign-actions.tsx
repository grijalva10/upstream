"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Play, Pause, Loader2, CheckCircle, AlertCircle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  scheduledStartAt?: string | null;
  hasEmails: boolean;
}

function getDefaultStartTime(): string {
  const now = new Date();
  // Round up to next hour
  now.setHours(now.getHours() + 1, 0, 0, 0);
  // If before 9am, set to 9am
  if (now.getHours() < 9) {
    now.setHours(9, 0, 0, 0);
  }
  // If after 5pm, set to 9am next day
  if (now.getHours() >= 17) {
    now.setDate(now.getDate() + 1);
    now.setHours(9, 0, 0, 0);
  }
  // Skip weekends
  while (now.getDay() === 0 || now.getDay() === 6) {
    now.setDate(now.getDate() + 1);
  }
  return now.toISOString().slice(0, 16);
}

export function CampaignActions({
  campaignId,
  status,
  enrollmentCount,
  scheduledStartAt,
  hasEmails,
}: CampaignActionsProps) {
  const router = useRouter();
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [startDateTime, setStartDateTime] = useState(
    scheduledStartAt ? new Date(scheduledStartAt).toISOString().slice(0, 16) : getDefaultStartTime()
  );
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

  const handleActivate = async () => {
    setIsActivating(true);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledStartAt: new Date(startDateTime).toISOString() }),
      });

      const data = await res.json();

      if (res.ok) {
        showNotification(
          "success",
          `Campaign activated. ${data.emailsScheduled} emails scheduled.`
        );
        router.refresh();
      } else {
        showNotification("error", data.error || "Failed to activate campaign");
      }
    } catch {
      showNotification("error", "Failed to activate campaign");
    } finally {
      setIsActivating(false);
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
          newStatus === "active" ? "Campaign resumed" : "Campaign paused"
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
  const canActivate = isDraft && enrollmentCount > 0 && hasEmails;
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

        {/* Activate button - draft with enrollments and emails */}
        {canActivate && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={isActivating} className="gap-2">
                {isActivating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Activate Campaign
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>Activate this campaign?</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-4">
                    <p>
                      This will schedule emails for all {enrollmentCount} enrolled contacts.
                    </p>

                    <div className="space-y-2">
                      <Label htmlFor="start-datetime" className="text-foreground flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Start sending at
                      </Label>
                      <Input
                        id="start-datetime"
                        type="datetime-local"
                        value={startDateTime}
                        onChange={(e) => setStartDateTime(e.target.value)}
                        className="text-foreground"
                      />
                      <p className="text-xs text-muted-foreground">
                        Emails will be sent within the campaign send window (9am-5pm in campaign timezone)
                      </p>
                    </div>

                    <p className="text-amber-600 dark:text-amber-400 text-sm">
                      Note: Emails will be queued but not sent until the worker is running.
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleActivate}
                  className="gap-2"
                  disabled={isActivating}
                >
                  {isActivating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Activate
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Show why can't activate */}
        {isDraft && enrollmentCount > 0 && !hasEmails && (
          <p className="text-sm text-muted-foreground">Generate emails to activate</p>
        )}
        {isDraft && enrollmentCount === 0 && (
          <p className="text-sm text-muted-foreground">Enroll contacts to activate</p>
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
