"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  Phone,
  Building2,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CallStatusBadge } from "../../_components/call-status-badge";
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

interface CallHeaderProps {
  call: {
    id: string;
    scheduled_at: string;
    duration_minutes: number;
    status: string;
    contact: {
      id: string;
      first_name: string;
      last_name: string;
      phone?: string;
      company?: {
        id: string;
        name: string;
      };
    };
    deal?: {
      id: string;
      display_id?: string;
      property?: {
        address: string;
        city: string;
        state: string;
      };
    };
  };
}

export function CallHeader({ call }: CallHeaderProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const updateStatus = async (status: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calls/${call.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error("Error updating call status:", err);
    } finally {
      setLoading(false);
    }
  };

  const contactName = `${call.contact.first_name} ${call.contact.last_name}`;
  const scheduledTime = format(new Date(call.scheduled_at), "EEEE, MMMM d 'at' h:mm a");
  const isScheduled = call.status === "scheduled";
  const isCompleted = call.status === "completed";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/calls">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{contactName}</h1>
            <CallStatusBadge status={call.status} />
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            {call.contact.company && (
              <span className="flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                {call.contact.company.name}
              </span>
            )}
            {call.deal?.property && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {call.deal.property.address}, {call.deal.property.city}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{scheduledTime}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{call.duration_minutes} min</span>
          </div>
          {call.contact.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{call.contact.phone}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isScheduled && (
            <>
              <Button
                variant="outline"
                onClick={() => updateStatus("no_show")}
                disabled={loading}
              >
                <XCircle className="mr-2 h-4 w-4" />
                No Show
              </Button>
              <Button onClick={() => updateStatus("completed")} disabled={loading}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Complete Call
              </Button>
            </>
          )}

          {isCompleted && (
            <Button variant="outline" onClick={() => updateStatus("scheduled")} disabled={loading}>
              Reopen
            </Button>
          )}

          {!isScheduled && !isCompleted && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={loading}>
                  Cancel Call
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this call?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark the call as cancelled. You can schedule a new
                    call if needed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Call</AlertDialogCancel>
                  <AlertDialogAction onClick={() => updateStatus("cancelled")}>
                    Cancel Call
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}
