"use client";

import { XIcon, User, Building2, Mail, Search, Home, Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EntityContext, EntityType } from "./types";

interface AIContextCardProps {
  context: EntityContext;
  onClear: () => void;
}

const entityIcons: Record<NonNullable<EntityType>, React.ElementType> = {
  contact: User,
  company: Building2,
  email: Mail,
  search: Search,
  property: Home,
  deal: Briefcase,
};

const entityLabels: Record<NonNullable<EntityType>, string> = {
  contact: "Contact",
  company: "Company",
  email: "Email",
  search: "Search",
  property: "Property",
  deal: "Deal",
};

function getDisplayName(context: EntityContext): string {
  const data = context.data;
  if (!data) return "Unknown";

  // Try common name fields
  if (typeof data.name === 'string') return data.name;
  if (typeof data.full_name === 'string') return data.full_name;
  if (typeof data.subject === 'string') return data.subject;
  if (typeof data.title === 'string') return data.title;

  // For contacts, try first + last name
  if (typeof data.first_name === 'string' && typeof data.last_name === 'string') {
    return `${data.first_name} ${data.last_name}`.trim();
  }

  // For emails, try from_name or from_email
  if (typeof data.from_name === 'string') return data.from_name;
  if (typeof data.from_email === 'string') return data.from_email;

  return "Unknown";
}

function getSubtitle(context: EntityContext): string | null {
  const data = context.data;
  if (!data) return null;

  switch (context.type) {
    case 'contact':
      if (typeof data.email === 'string') return data.email;
      if (typeof data.company === 'object' && data.company && 'name' in data.company) {
        return data.company.name as string;
      }
      break;
    case 'company':
      if (typeof data.status === 'string') return `Status: ${data.status}`;
      break;
    case 'email':
      if (typeof data.from_email === 'string' && typeof data.from_name === 'string') {
        return data.from_email;
      }
      break;
    case 'search':
      if (typeof data.status === 'string') return `Status: ${data.status}`;
      break;
    case 'property':
      if (typeof data.address === 'string') return data.address;
      break;
    case 'deal':
      if (typeof data.status === 'string') return `Status: ${data.status}`;
      break;
  }
  return null;
}

export function AIContextCard({ context, onClear }: AIContextCardProps) {
  if (!context.type) return null;

  const Icon = entityIcons[context.type];
  const label = entityLabels[context.type];
  const displayName = getDisplayName(context);
  const subtitle = getSubtitle(context);

  return (
    <Card className="border-dashed">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-md bg-muted flex items-center justify-center">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {label}
              </Badge>
            </div>
            <p className="mt-1 font-medium text-sm truncate">{displayName}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={onClear}
          >
            <XIcon className="h-3 w-3" />
            <span className="sr-only">Clear context</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
