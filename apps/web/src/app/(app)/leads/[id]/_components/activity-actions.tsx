"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Contact {
  id: string;
  name: string;
  email: string | null;
}

interface ActivityActionsProps {
  leadId: string;
  contacts: Contact[];
}

export function ActivityActions({ leadId, contacts }: ActivityActionsProps) {
  const router = useRouter();

  // Note dialog state
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  // Email dialog state
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailForm, setEmailForm] = useState({
    contactId: "",
    subject: "",
    body: "",
  });
  const [emailSaving, setEmailSaving] = useState(false);

  // Filter contacts with email addresses
  const contactsWithEmail = contacts.filter((c) => c.email);

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNoteSaving(true);

    try {
      const res = await fetch(`/api/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteText }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save note");
      }

      setNoteOpen(false);
      setNoteText("");
      router.refresh();
    } catch (error) {
      console.error("Error saving note:", error);
      alert(error instanceof Error ? error.message : "Failed to save note");
    } finally {
      setNoteSaving(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailSaving(true);

    try {
      const res = await fetch(`/api/leads/${leadId}/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: emailForm.contactId,
          subject: emailForm.subject,
          emailBody: emailForm.body,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to queue email");
      }

      setEmailOpen(false);
      setEmailForm({ contactId: "", subject: "", body: "" });
      router.refresh();
      alert("Email queued for sending");
    } catch (error) {
      console.error("Error sending email:", error);
      alert(error instanceof Error ? error.message : "Failed to send email");
    } finally {
      setEmailSaving(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setNoteOpen(true)}>
          <MessageSquare className="h-4 w-4 mr-1.5" />
          Note
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEmailOpen(true)}
          disabled={contactsWithEmail.length === 0}
        >
          <Mail className="h-4 w-4 mr-1.5" />
          Email
        </Button>
      </div>

      {/* Add Note Dialog */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <form onSubmit={handleNoteSubmit}>
            <DialogHeader>
              <DialogTitle>Add Note</DialogTitle>
              <DialogDescription>
                Add a note to this lead's activity timeline.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                placeholder="Enter your note..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={4}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setNoteOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={noteSaving || !noteText.trim()}>
                {noteSaving ? "Saving..." : "Save Note"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Compose Email Dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleEmailSubmit}>
            <DialogHeader>
              <DialogTitle>Compose Email</DialogTitle>
              <DialogDescription>
                Send an email to a contact. The email will be queued for sending.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="contact">To *</Label>
                <Select
                  value={emailForm.contactId}
                  onValueChange={(value) =>
                    setEmailForm({ ...emailForm, contactId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {contactsWithEmail.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.name} ({contact.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  placeholder="Email subject"
                  value={emailForm.subject}
                  onChange={(e) =>
                    setEmailForm({ ...emailForm, subject: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="body">Message *</Label>
                <Textarea
                  id="body"
                  placeholder="Write your email..."
                  value={emailForm.body}
                  onChange={(e) =>
                    setEmailForm({ ...emailForm, body: e.target.value })
                  }
                  rows={6}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEmailOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  emailSaving ||
                  !emailForm.contactId ||
                  !emailForm.subject.trim() ||
                  !emailForm.body.trim()
                }
              >
                {emailSaving ? "Sending..." : "Send Email"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
