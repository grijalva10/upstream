"use client";

import { Check, X, Loader2, UserPlus, Search, Briefcase, Mail, ListTodo, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SuggestedAction } from "./types";

interface AIActionCardProps {
  action: SuggestedAction;
  onConfirm: (action: SuggestedAction) => void;
  onReject: (action: SuggestedAction) => void;
  isExecuting?: boolean;
}

const actionConfig: Record<SuggestedAction["type"], { icon: React.ElementType; label: string }> = {
  create_contact: { icon: UserPlus, label: "Create Contact" },
  create_search: { icon: Search, label: "Create Search" },
  create_deal: { icon: Briefcase, label: "Create Deal" },
  send_email: { icon: Mail, label: "Send Email" },
  create_task: { icon: ListTodo, label: "Create Task" },
  update_contact: { icon: UserPlus, label: "Update Contact" },
  mark_dnc: { icon: UserX, label: "Mark as DNC" },
};

// Field display names for each action type
const actionFields: Record<string, string[]> = {
  create_contact: ["first_name", "last_name", "email", "phone", "company_name", "role", "type"],
  create_search: ["name", "property_type", "market", "budget"],
  create_deal: ["property_name", "status"],
  send_email: ["to", "subject"],
  create_task: ["title", "due_date"],
  update_contact: ["contact_name", "reason"],
  mark_dnc: ["contact_name", "reason"],
};

function formatFieldName(field: string): string {
  return field.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function getDataLines(action: SuggestedAction): string[] {
  const fields = actionFields[action.type] || [];
  return fields
    .filter((field) => action.data[field])
    .map((field) => `${formatFieldName(field)}: ${action.data[field]}`);
}

export function AIActionCard({ action, onConfirm, onReject, isExecuting }: AIActionCardProps) {
  const config = actionConfig[action.type];
  const Icon = config.icon;
  const label = action.label || config.label;
  const dataLines = getDataLines(action);

  if (action.confirmed) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
        <span className="text-sm font-medium text-green-700 dark:text-green-300">
          {label} - Done
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-primary/5 border border-primary/20 overflow-hidden">
      <div className="px-3 py-2.5 flex items-center gap-2 border-b border-primary/10">
        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>

      {dataLines.length > 0 && (
        <div className="px-3 py-2 space-y-0.5 bg-background/50">
          {dataLines.map((line, i) => (
            <p key={i} className="text-xs text-muted-foreground">{line}</p>
          ))}
        </div>
      )}

      <div className="flex gap-2 px-3 py-2 bg-muted/30">
        <Button
          size="sm"
          onClick={() => onConfirm(action)}
          disabled={isExecuting}
          className="h-7 text-xs"
        >
          {isExecuting ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Check className="h-3 w-3 mr-1" />
          )}
          Confirm
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onReject(action)}
          disabled={isExecuting}
          className="h-7 text-xs"
        >
          <X className="h-3 w-3 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
