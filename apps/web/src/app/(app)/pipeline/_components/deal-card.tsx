"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Deal } from "@/lib/deals/schema";
import { getQualificationProgress, getDaysInStage, formatPrice, isQualified } from "@/lib/deals/utils";

interface DealCardProps {
  deal: Deal;
  isDragOverlay?: boolean;
}

export function DealCard({ deal, isDragOverlay }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const { completed, total } = getQualificationProgress(deal);
  const days = getDaysInStage(deal.updated_at);
  const qualified = isQualified(deal);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card border rounded-lg p-3 shadow-sm",
        "hover:shadow-md transition-shadow cursor-pointer",
        isDragging && "opacity-40",
        isDragOverlay && "shadow-lg rotate-2 scale-105"
      )}
    >
      {/* Header: drag handle + ID + badges */}
      <div className="flex items-center gap-2 mb-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 hover:bg-muted rounded touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>

        <Link
          href={`/pipeline/${deal.id}`}
          className="text-xs font-mono text-muted-foreground hover:text-foreground"
        >
          {deal.display_id}
        </Link>

        <div className="ml-auto flex items-center gap-1">
          {qualified && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0">
              Qualified
            </Badge>
          )}
          {!qualified && days > 5 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-300">
              {days}d
            </Badge>
          )}
        </div>
      </div>

      {/* Body: clickable link area */}
      <Link href={`/pipeline/${deal.id}`} className="block space-y-2">
        <p className="font-medium text-sm truncate">
          {deal.properties?.address ?? "No address"}
        </p>

        <p className="text-xs text-muted-foreground truncate">
          {deal.companies?.name ?? "No company"}
        </p>

        {deal.asking_price && (
          <p className="text-sm font-medium text-green-600">
            {formatPrice(deal.asking_price)}
            {deal.cap_rate && (
              <span className="text-muted-foreground font-normal ml-1.5">
                {deal.cap_rate.toFixed(1)}%
              </span>
            )}
          </p>
        )}

        {/* Progress */}
        <div className="flex items-center gap-2 pt-1">
          <Progress value={(completed / total) * 100} className="h-1 flex-1" />
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {completed}/{total}
          </span>
        </div>
      </Link>
    </div>
  );
}
