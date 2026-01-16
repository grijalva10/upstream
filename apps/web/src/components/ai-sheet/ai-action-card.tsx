"use client";

import { Check, X, Loader2, UserPlus, Search, Briefcase, Mail, ListTodo, UserX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SuggestedAction } from "./types";

interface AIActionCardProps {
  action: SuggestedAction;
  onConfirm: (action: SuggestedAction) => void;
  onReject: (action: SuggestedAction) => void;
  isExecuting?: boolean;
}

const actionIcons: Record<SuggestedAction['type'], React.ElementType> = {
  create_contact: UserPlus,
  create_search: Search,
  create_deal: Briefcase,
  send_email: Mail,
  create_task: ListTodo,
  update_contact: UserPlus,
  mark_dnc: UserX,
};

const actionLabels: Record<SuggestedAction['type'], string> = {
  create_contact: "Create Contact",
  create_search: "Create Search",
  create_deal: "Create Deal",
  send_email: "Send Email",
  create_task: "Create Task",
  update_contact: "Update Contact",
  mark_dnc: "Mark as DNC",
};

function formatActionData(action: SuggestedAction): string[] {
  const data = action.data;
  const lines: string[] = [];

  switch (action.type) {
    case 'create_contact':
      if (data.name) lines.push(`Name: ${data.name}`);
      if (data.first_name && data.last_name) lines.push(`Name: ${data.first_name} ${data.last_name}`);
      if (data.email) lines.push(`Email: ${data.email}`);
      if (data.phone) lines.push(`Phone: ${data.phone}`);
      if (data.company_name) lines.push(`Company: ${data.company_name}`);
      if (data.role) lines.push(`Role: ${data.role}`);
      if (data.type) lines.push(`Type: ${data.type}`);
      break;
    case 'create_search':
      if (data.name) lines.push(`Name: ${data.name}`);
      if (data.property_type) lines.push(`Property Type: ${data.property_type}`);
      if (data.market) lines.push(`Market: ${data.market}`);
      if (data.budget) lines.push(`Budget: ${data.budget}`);
      break;
    case 'create_deal':
      if (data.property_name) lines.push(`Property: ${data.property_name}`);
      if (data.status) lines.push(`Status: ${data.status}`);
      break;
    case 'send_email':
      if (data.to) lines.push(`To: ${data.to}`);
      if (data.subject) lines.push(`Subject: ${data.subject}`);
      break;
    case 'create_task':
      if (data.title) lines.push(`Title: ${data.title}`);
      if (data.due_date) lines.push(`Due: ${data.due_date}`);
      break;
    case 'update_contact':
    case 'mark_dnc':
      if (data.contact_name) lines.push(`Contact: ${data.contact_name}`);
      if (data.reason) lines.push(`Reason: ${data.reason}`);
      break;
  }

  return lines;
}

export function AIActionCard({ action, onConfirm, onReject, isExecuting }: AIActionCardProps) {
  const Icon = actionIcons[action.type];
  const label = action.label || actionLabels[action.type];
  const dataLines = formatActionData(action);

  if (action.confirmed) {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <Check className="h-4 w-4" />
            <span className="text-sm font-medium">{label} - Confirmed</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
      <CardContent className="p-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Icon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {label}
            </span>
          </div>

          {dataLines.length > 0 && (
            <div className="pl-8 space-y-0.5">
              {dataLines.map((line, i) => (
                <p key={i} className="text-xs text-blue-600 dark:text-blue-400">
                  {line}
                </p>
              ))}
            </div>
          )}

          <div className="flex gap-2 pl-8">
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
              onClick={() => onConfirm(action)}
              disabled={isExecuting}
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
              className="h-7 text-xs text-blue-600 hover:text-blue-700"
              onClick={() => onReject(action)}
              disabled={isExecuting}
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
