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

const LEAD_TYPES = [
  { value: "seller", label: "Seller" },
  { value: "buyer", label: "Buyer" },
  { value: "buyer_seller", label: "Buyer/Seller" },
  { value: "broker", label: "Broker" },
  { value: "other", label: "Other" },
] as const;

interface TypeSelectProps {
  leadId: string;
  currentType: string | null;
}

export function TypeSelect({ leadId, currentType }: TypeSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState(currentType || "seller");

  const currentLabel = LEAD_TYPES.find((t) => t.value === type)?.label ?? type;

  async function handleTypeChange(newType: string) {
    if (newType === type) return;

    setType(newType);

    const res = await fetch(`/api/leads/${leadId}/type`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_type: newType }),
    });

    if (res.ok) {
      startTransition(() => {
        router.refresh();
      });
    } else {
      setType(currentType || "seller");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        className={cn(
          "inline-flex items-center gap-1 text-sm text-muted-foreground",
          "hover:text-foreground transition-colors cursor-pointer capitalize",
          "focus:outline-none",
          isPending && "opacity-50 cursor-wait"
        )}
      >
        {currentLabel}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {LEAD_TYPES.map((t) => (
          <DropdownMenuItem
            key={t.value}
            onClick={() => handleTypeChange(t.value)}
            className={cn(
              "cursor-pointer",
              t.value === type && "bg-accent"
            )}
          >
            {t.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
