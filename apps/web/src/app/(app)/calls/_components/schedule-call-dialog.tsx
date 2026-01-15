"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format, addDays } from "date-fns";
import { Plus, CheckCircle, Calendar, Clock } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ContactCombobox } from "./contact-combobox";

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  company?: {
    id: string;
    name: string;
  };
}

interface Deal {
  id: string;
  display_id: string;
  property?: {
    address: string;
    city: string;
  };
}

interface ScheduleCallDialogProps {
  preselectedContact?: Contact;
  preselectedDeal?: Deal;
  trigger?: React.ReactNode;
}

export function ScheduleCallDialog({
  preselectedContact,
  preselectedDeal,
  trigger,
}: ScheduleCallDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [contact, setContact] = useState<Contact | null>(preselectedContact || null);
  const [dealId, setDealId] = useState<string>(preselectedDeal?.id || "");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [date, setDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState("30");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    id: string;
    message: string;
  } | null>(null);

  // Fetch deals when contact changes
  useEffect(() => {
    if (!contact?.company?.id) {
      setDeals([]);
      return;
    }

    const fetchDeals = async () => {
      try {
        const res = await fetch(
          `/api/data/deals?company_id=${contact.company!.id}&limit=20`
        );
        const data = await res.json();
        setDeals(data.deals || []);
      } catch (err) {
        console.error("Error fetching deals:", err);
        setDeals([]);
      }
    };

    fetchDeals();
  }, [contact?.company?.id]);

  const handleSubmit = async () => {
    setError("");
    setResult(null);

    if (!contact) {
      setError("Please select a contact");
      return;
    }

    if (!date || !time) {
      setError("Please select a date and time");
      return;
    }

    setLoading(true);

    try {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();

      const response = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contact.id,
          deal_id: dealId || null,
          scheduled_at: scheduledAt,
          duration_minutes: parseInt(duration),
          notes: notes || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to schedule call");
        setLoading(false);
        return;
      }

      // Generate call prep
      await fetch(`/api/calls/${data.id}/prep`, { method: "POST" });

      setLoading(false);
      setResult(data);
    } catch (err) {
      console.error("Error scheduling call:", err);
      setError("Failed to connect to API");
      setLoading(false);
    }
  };

  const handleClose = () => {
    const hadResult = result !== null;
    setOpen(false);
    setContact(preselectedContact || null);
    setDealId(preselectedDeal?.id || "");
    setDate(format(addDays(new Date(), 1), "yyyy-MM-dd"));
    setTime("10:00");
    setDuration("30");
    setNotes("");
    setError("");
    setResult(null);
    if (hadResult) {
      router.refresh();
    }
  };

  // Generate time options (9:00 AM to 6:00 PM in 15-minute increments)
  const timeOptions = [];
  for (let hour = 9; hour <= 18; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const h = hour.toString().padStart(2, "0");
      const m = minute.toString().padStart(2, "0");
      const label = format(new Date(`2000-01-01T${h}:${m}:00`), "h:mm a");
      timeOptions.push({ value: `${h}:${m}`, label });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Schedule Call
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule Call</DialogTitle>
          <DialogDescription>
            Schedule a call with a contact. A call prep document will be
            generated automatically.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-4">
            <div className="rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <p className="font-medium text-green-600">Call Scheduled!</p>
              </div>
              <p className="text-sm text-muted-foreground">{result.message}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button
                onClick={() => {
                  handleClose();
                  router.push(`/calls/${result.id}`);
                }}
              >
                View Call
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Contact *</Label>
                <ContactCombobox
                  value={contact}
                  onChange={setContact}
                  disabled={!!preselectedContact}
                />
              </div>

              {deals.length > 0 && (
                <div className="space-y-2">
                  <Label>Deal (optional)</Label>
                  <Select value={dealId} onValueChange={setDealId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a deal..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No deal</SelectItem>
                      {deals.map((deal) => (
                        <SelectItem key={deal.id} value={deal.id}>
                          {deal.display_id}
                          {deal.property && ` - ${deal.property.address}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="call-date">
                    <Calendar className="inline h-4 w-4 mr-1" />
                    Date *
                  </Label>
                  <Input
                    id="call-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={format(new Date(), "yyyy-MM-dd")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="call-time">
                    <Clock className="inline h-4 w-4 mr-1" />
                    Time *
                  </Label>
                  <Select value={time} onValueChange={setTime}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Duration</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="call-notes">Notes (optional)</Label>
                <Textarea
                  id="call-notes"
                  placeholder="Any notes or context for this call..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={loading || !contact}>
                {loading ? "Scheduling..." : "Schedule Call"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
