"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const LEAD_STATUSES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "engaged", label: "Engaged" },
  { value: "qualified", label: "Qualified" },
  { value: "handed_off", label: "Handed Off" },
  { value: "nurture", label: "Nurture" },
  { value: "pass", label: "Pass" },
  { value: "dnc", label: "DNC" },
  { value: "rejected", label: "Rejected" },
] as const;

const statusStyles: Record<string, string> = {
  new: "bg-slate-100 text-slate-700",
  contacted: "bg-blue-100 text-blue-700",
  engaged: "bg-amber-100 text-amber-700",
  qualified: "bg-green-100 text-green-700",
  handed_off: "bg-purple-100 text-purple-700",
  nurture: "bg-cyan-100 text-cyan-700",
  pass: "bg-gray-100 text-gray-600",
  dnc: "bg-red-100 text-red-700",
  rejected: "bg-gray-100 text-gray-600",
};

interface StatusSelectProps {
  leadId: string;
  currentStatus: string;
}

export function StatusSelect({ leadId, currentStatus }: StatusSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(currentStatus);

  const currentLabel = LEAD_STATUSES.find((s) => s.value === status)?.label ?? status;

  async function handleStatusChange(newStatus: string) {
    if (newStatus === status) return;

    setStatus(newStatus);

    const res = await fetch(`/api/leads/${leadId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (res.ok) {
      startTransition(() => {
        router.refresh();
      });
    } else {
      setStatus(currentStatus);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        className={cn(
          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium",
          "hover:opacity-80 transition-opacity cursor-pointer",
          "focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-400",
          statusStyles[status],
          isPending && "opacity-50 cursor-wait"
        )}
      >
        {currentLabel}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {LEAD_STATUSES.map((s) => (
          <DropdownMenuItem
            key={s.value}
            onClick={() => handleStatusChange(s.value)}
            className={cn(
              "cursor-pointer",
              s.value === status && "bg-accent"
            )}
          >
            <span
              className={cn(
                "inline-block w-2 h-2 rounded-full mr-2",
                statusStyles[s.value]?.replace("text-", "bg-").split(" ")[0]
              )}
            />
            {s.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
