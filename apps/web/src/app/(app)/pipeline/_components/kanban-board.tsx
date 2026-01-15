"use client";

import { useOptimistic, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { KanbanColumn } from "./kanban-column";
import { DealCard } from "./deal-card";
import { updateDealStatus } from "@/lib/deals/actions";
import { COLUMNS } from "@/lib/deals/constants";
import { groupByStatus } from "@/lib/deals/utils";
import type { Deal, DealStatus } from "@/lib/deals/schema";
import { useState } from "react";

interface KanbanBoardProps {
  deals: Deal[];
}

type OptimisticAction = { type: "move"; dealId: string; status: DealStatus };

export function KanbanBoard({ deals }: KanbanBoardProps) {
  const [, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Optimistic state for instant UI updates
  const [optimisticDeals, applyOptimistic] = useOptimistic(
    deals,
    (state, action: OptimisticAction) => {
      if (action.type === "move") {
        return state.map((d) =>
          d.id === action.dealId ? { ...d, status: action.status } : d
        );
      }
      return state;
    }
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const grouped = groupByStatus(optimisticDeals);
  const activeDeal = activeId ? optimisticDeals.find((d) => d.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);

    const { active, over } = event;
    if (!over) return;

    const dealId = active.id as string;
    const newStatus = over.id as DealStatus;
    const deal = optimisticDeals.find((d) => d.id === dealId);

    if (!deal || deal.status === newStatus) return;

    // Apply optimistic update + trigger server action
    startTransition(async () => {
      applyOptimistic({ type: "move", dealId, status: newStatus });
      await updateDealStatus(dealId, newStatus);
    });
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 h-full overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            color={col.color}
            deals={grouped[col.id] ?? []}
          />
        ))}
      </div>

      <DragOverlay>
        {activeDeal && <DealCard deal={activeDeal} isDragOverlay />}
      </DragOverlay>
    </DndContext>
  );
}
