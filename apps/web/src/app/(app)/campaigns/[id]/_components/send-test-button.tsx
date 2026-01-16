"use client";

import { useState, useEffect } from "react";
import { Send, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Enrollment {
  id: string;
  contact: { id: string; name: string | null; email: string | null } | null;
  property: { id: string; address: string | null; city: string | null; state_code: string | null } | null;
}

interface SendTestButtonProps {
  campaignId: string;
  disabled?: boolean;
}

export function SendTestButton({ campaignId, disabled }: SendTestButtonProps) {
  const [open, setOpen] = useState(false);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedEnrollment, setSelectedEnrollment] = useState<string>("");
  const [testEmail, setTestEmail] = useState("grijalva10@gmail.com");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Load enrollments when dialog opens
  useEffect(() => {
    if (open && enrollments.length === 0) {
      setIsLoading(true);
      fetch(`/api/campaigns/${campaignId}/send-test`)
        .then((res) => res.json())
        .then((data) => {
          setEnrollments(data.enrollments || []);
          if (data.enrollments?.length > 0) {
            setSelectedEnrollment(data.enrollments[0].id);
          }
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [open, campaignId, enrollments.length]);

  const handleSend = async () => {
    if (!testEmail || !selectedEnrollment) return;

    setIsSending(true);
    setResult(null);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/send-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testEmail,
          enrollmentId: selectedEnrollment,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult({
          type: "success",
          message: `Queued ${data.emailsQueued} test emails to ${testEmail}. Check your inbox!`,
        });
      } else {
        setResult({
          type: "error",
          message: data.error || "Failed to send test emails",
        });
      }
    } catch {
      setResult({
        type: "error",
        message: "Failed to send test emails",
      });
    } finally {
      setIsSending(false);
    }
  };

  const selectedContact = enrollments.find((e) => e.id === selectedEnrollment);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="gap-2">
          <Send className="h-4 w-4" />
          Send Test
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Test Emails</DialogTitle>
          <DialogDescription>
            Send all 3 emails in the sequence to a test address using real contact data for personalization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Contact selector */}
          <div className="space-y-2">
            <Label>Use data from contact</Label>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading contacts...
              </div>
            ) : enrollments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No enrollments found. Enroll contacts first.
              </p>
            ) : (
              <Select value={selectedEnrollment} onValueChange={setSelectedEnrollment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a contact" />
                </SelectTrigger>
                <SelectContent>
                  {enrollments.map((enrollment) => (
                    <SelectItem key={enrollment.id} value={enrollment.id}>
                      <span className="font-medium">
                        {enrollment.contact?.name || "Unknown"}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        {enrollment.property?.address
                          ? `- ${enrollment.property.address}`
                          : ""}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedContact && (
              <p className="text-xs text-muted-foreground">
                Property: {selectedContact.property?.address}, {selectedContact.property?.city}, {selectedContact.property?.state_code}
              </p>
            )}
          </div>

          {/* Test email input */}
          <div className="space-y-2">
            <Label htmlFor="test-email">Send to email</Label>
            <Input
              id="test-email"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="your@email.com"
            />
            <p className="text-xs text-muted-foreground">
              All 3 emails will be sent here, 10 seconds apart
            </p>
          </div>

          {/* Result message */}
          {result && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                result.type === "success"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
              }`}
            >
              {result.type === "success" ? (
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
              )}
              {result.message}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || !testEmail || !selectedEnrollment}
            className="gap-2"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send 3 Test Emails
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
