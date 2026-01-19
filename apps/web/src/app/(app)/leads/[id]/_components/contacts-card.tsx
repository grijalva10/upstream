"use client";

import { useState } from "react";
import { Mail, Phone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  status: string;
  contact_type: string | null;
}

interface ContactsCardProps {
  contacts: Contact[];
  leadId: string;
}

export function ContactsCard({ contacts, leadId }: ContactsCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    title: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`/api/leads/${leadId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setDialogOpen(false);
        setFormData({ name: "", email: "", phone: "", title: "" });
        // Refresh the page to show new contact
        window.location.reload();
      }
    } catch (error) {
      console.error("Failed to create contact:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Contacts
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>

        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">
            No contacts yet
          </p>
        ) : (
          <div className="p-4 space-y-3">
            {contacts.map((contact) => (
              <div key={contact.id}>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{contact.name}</p>
                  {contact.status !== "active" && (
                    <span className="text-xs text-muted-foreground">
                      · {contact.status}
                    </span>
                  )}
                </div>
                {contact.title && (
                  <p className="text-xs text-muted-foreground">
                    {contact.title}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Mail className="h-3 w-3" />
                      <span className="truncate max-w-[140px]">{contact.email}</span>
                    </a>
                  )}
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone}`}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Phone className="h-3 w-3" />
                      <span>{contact.phone}</span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Contact Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Smith"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Property Manager"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !formData.name}>
                {saving ? "Adding..." : "Add Contact"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
