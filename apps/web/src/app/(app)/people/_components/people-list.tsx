"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Mail,
  Phone,
  Building2,
  User,
  MoreHorizontal,
  ExternalLink,
  DollarSign,
  Crown,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  status: string;
  is_buyer: boolean | null;
  is_seller: boolean | null;
  is_decision_maker: boolean | null;
  last_contacted_at: string | null;
  created_at: string | null;
  company: { id: string; name: string } | null;
}

interface PeopleListProps {
  contacts: Contact[];
  emptyTitle: string;
  emptyDescription: string;
}

const statusVariants: Record<string, "default" | "success" | "warning" | "destructive" | "secondary" | "blue"> = {
  active: "success",
  new: "blue",
  contacted: "secondary",
  dnc: "destructive",
  bounced: "destructive",
  unsubscribed: "warning",
};

export function PeopleList({
  contacts,
  emptyTitle,
  emptyDescription,
}: PeopleListProps) {
  if (contacts.length === 0) {
    return (
      <EmptyState
        icon={User}
        title={emptyTitle}
        description={emptyDescription}
        action={{
          label: "Add Contact",
          variant: "default",
        }}
      />
    );
  }

  return (
    <div className="space-y-2">
      {contacts.map((contact) => (
        <Card
          key={contact.id}
          elevation="card"
          padding="none"
          className="p-4 hover:shadow-dropdown transition-shadow"
        >
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-foreground font-medium shrink-0">
              {contact.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>

            {/* Contact info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{contact.name}</h3>
                    {contact.is_decision_maker && (
                      <Crown className="h-4 w-4 text-amber-500" aria-label="Decision Maker" />
                    )}
                    {contact.is_buyer && (
                      <Badge variant="green" size="sm">
                        <DollarSign className="h-3 w-3 mr-0.5" />
                        Buyer
                      </Badge>
                    )}
                    {contact.is_seller && (
                      <Badge variant="blue" size="sm">
                        <Building2 className="h-3 w-3 mr-0.5" />
                        Seller
                      </Badge>
                    )}
                  </div>

                  {contact.title && (
                    <p className="text-body-sm text-muted-foreground">
                      {contact.title}
                    </p>
                  )}

                  {/* Contact details */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-caption text-muted-foreground">
                    {contact.company && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {contact.company.name}
                      </span>
                    )}
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        <Mail className="h-3 w-3" />
                        {contact.email}
                      </a>
                    )}
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone}`}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        <Phone className="h-3 w-3" />
                        {contact.phone}
                      </a>
                    )}
                  </div>
                </div>

                {/* Status and actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={statusVariants[contact.status] || "secondary"}
                    size="sm"
                  >
                    {contact.status}
                  </Badge>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Mail className="h-4 w-4 mr-2" />
                        Send Email
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Phone className="h-4 w-4 mr-2" />
                        Schedule Call
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        Add to DNC
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Last contacted */}
              {contact.last_contacted_at && (
                <p className="text-caption text-muted-foreground mt-2">
                  Last contacted{" "}
                  {formatDistanceToNow(new Date(contact.last_contacted_at), {
                    addSuffix: true,
                  })}
                </p>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
