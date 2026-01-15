"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PipelineFiltersProps {
  searches: { id: string; name: string }[];
}

export function PipelineFilters({ searches }: PipelineFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSearch = searchParams.get("search") ?? "";
  const currentSearchId = searchParams.get("searchId") ?? "";

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    startTransition(() => {
      router.push(`/pipeline?${params.toString()}`, { scroll: false });
    });
  }

  function clearFilters() {
    startTransition(() => {
      router.push("/pipeline", { scroll: false });
    });
  }

  const hasFilters = currentSearch || currentSearchId;

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search deals..."
          defaultValue={currentSearch}
          onChange={(e) => updateParam("search", e.target.value || null)}
          className="pl-9"
        />
      </div>

      <Select
        value={currentSearchId || "all"}
        onValueChange={(v) => updateParam("searchId", v === "all" ? null : v)}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="All sources" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sources</SelectItem>
          {searches.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
