"use client";

import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface Contact {
  id: string;
  name: string | null;
  email?: string;
  phone?: string;
  company?: {
    id: string;
    name: string;
  };
}

interface ContactComboboxProps {
  value: Contact | null;
  onChange: (contact: Contact | null) => void;
  disabled?: boolean;
}

export function ContactCombobox({
  value,
  onChange,
  disabled,
}: ContactComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    const fetchContacts = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: "20",
          ...(search && { search }),
        });
        const res = await fetch(`/api/data/contacts?${params}`);
        const data = await res.json();
        setContacts(data.contacts || []);
      } catch (err) {
        console.error("Error fetching contacts:", err);
        setContacts([]);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchContacts, 300);
    return () => clearTimeout(debounce);
  }, [open, search]);

  const displayValue = value
    ? `${value.name || "Unknown"}${value.company ? ` - ${value.company.name}` : ""}`
    : "Select contact...";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : contacts.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {search ? "No contacts found" : "Start typing to search"}
            </div>
          ) : (
            <div className="p-1">
              {contacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => {
                    onChange(contact);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent",
                    value?.id === contact.id && "bg-accent"
                  )}
                >
                  <User className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {contact.name || "Unknown"}
                      </span>
                      {value?.id === contact.id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    {contact.company && (
                      <div className="text-xs text-muted-foreground truncate">
                        {contact.company.name}
                      </div>
                    )}
                    {contact.email && (
                      <div className="text-xs text-muted-foreground truncate">
                        {contact.email}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
