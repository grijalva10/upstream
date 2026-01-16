"use client";

import { XIcon, User, Building2, Mail, Search, Home, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EntityContext, EntityType } from "./types";

interface AIContextCardProps {
  context: EntityContext;
  onClear: () => void;
}

const entityConfig: Record<NonNullable<EntityType>, { icon: React.ElementType; label: string }> = {
  contact: { icon: User, label: "Contact" },
  company: { icon: Building2, label: "Company" },
  email: { icon: Mail, label: "Email" },
  search: { icon: Search, label: "Search" },
  property: { icon: Home, label: "Property" },
  deal: { icon: Briefcase, label: "Deal" },
};

function getDisplayInfo(context: EntityContext): { name: string; subtitle: string | null } {
  const data = context.data;
  if (!data) return { name: "Unknown", subtitle: null };

  // Get display name from common fields
  const name =
    (typeof data.name === "string" && data.name) ||
    (typeof data.subject === "string" && data.subject) ||
    (typeof data.title === "string" && data.title) ||
    (typeof data.first_name === "string" && typeof data.last_name === "string" && `${data.first_name} ${data.last_name}`.trim()) ||
    (typeof data.from_name === "string" && data.from_name) ||
    (typeof data.from_email === "string" && data.from_email) ||
    "Unknown";

  // Get subtitle based on entity type
  let subtitle: string | null = null;
  switch (context.type) {
    case "contact":
      subtitle = (typeof data.email === "string" && data.email) || null;
      break;
    case "email":
      subtitle = typeof data.from_email === "string" ? data.from_email : null;
      break;
    case "property":
      subtitle = typeof data.address === "string" ? data.address : null;
      break;
    default:
      subtitle = typeof data.status === "string" ? `Status: ${data.status}` : null;
  }

  return { name, subtitle };
}

export function AIContextCard({ context, onClear }: AIContextCardProps) {
  if (!context.type) return null;

  const config = entityConfig[context.type];
  const Icon = config.icon;
  const { name, subtitle } = getDisplayInfo(context);

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
            {config.label}
          </Badge>
        </div>
        <p className="mt-0.5 font-medium text-sm truncate">{name}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 flex-shrink-0 rounded-full hover:bg-destructive/10 hover:text-destructive"
        onClick={onClear}
      >
        <XIcon className="h-3.5 w-3.5" />
        <span className="sr-only">Clear context</span>
      </Button>
    </div>
  );
}
