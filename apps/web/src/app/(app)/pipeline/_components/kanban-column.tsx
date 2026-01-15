"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { DealCard } from "./deal-card";
import type { Deal, DealStatus } from "@/lib/deals/schema";

interface KanbanColumnProps {
  id: DealStatus;
  title: string;
  color: string;
  deals: Deal[];
}

export function KanbanColumn({ id, title, color, deals }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex-shrink-0 w-72 flex flex-col rounded-lg bg-muted/40 h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b">
        <div className={cn("w-2.5 h-2.5 rounded-full", color)} />
        <span className="font-medium text-sm">{title}</span>
        <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full tabular-nums">
          {deals.length}
        </span>
      </div>

      {/* Droppable area */}
      <ScrollArea className="flex-1">
        <div
          ref={setNodeRef}
          className={cn(
            "p-2 min-h-[120px] transition-colors",
            isOver && "bg-accent/50"
          )}
        >
          <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {deals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          </SortableContext>

          {deals.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-8">
              No deals
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
