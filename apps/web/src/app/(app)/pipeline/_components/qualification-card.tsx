"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EditableField } from "./editable-field";
import { getQualificationProgress, createFieldUpdater } from "@/lib/deals/utils";
import { MOTIVATIONS, TIMELINES } from "@/lib/deals/constants";
import type { Deal } from "@/lib/deals/schema";

interface QualificationCardProps {
  deal: Deal;
}

export function QualificationCard({ deal }: QualificationCardProps) {
  const { completed, total } = getQualificationProgress(deal);
  const capRate = deal.asking_price && deal.noi
    ? ((deal.noi / deal.asking_price) * 100).toFixed(2)
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Qualification</CardTitle>
          <div className="flex items-center gap-2">
            <Progress value={(completed / total) * 100} className="w-24 h-2" />
            <span className="text-sm text-muted-foreground">
              {completed}/{total}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <EditableField
          label="Asking Price"
          value={deal.asking_price}
          type="currency"
          placeholder="Enter asking price"
          onSave={createFieldUpdater(deal.id, "asking_price")}
        />

        <EditableField
          label="NOI (Net Operating Income)"
          value={deal.noi}
          type="currency"
          placeholder="Enter NOI"
          onSave={createFieldUpdater(deal.id, "noi")}
        />

        {/* Calculated Cap Rate */}
        {capRate && (
          <div className="p-3 bg-muted rounded-md">
            <p className="text-sm text-muted-foreground">Calculated Cap Rate</p>
            <p className="text-lg font-semibold">{capRate}%</p>
          </div>
        )}

        <EditableField
          label="Motivation (Why Selling)"
          value={deal.motivation}
          type="select"
          options={MOTIVATIONS}
          placeholder="Select motivation"
          onSave={createFieldUpdater(deal.id, "motivation")}
        />

        <EditableField
          label="Timeline (When Want to Close)"
          value={deal.timeline}
          type="select"
          options={TIMELINES}
          placeholder="Select timeline"
          onSave={createFieldUpdater(deal.id, "timeline")}
        />

        <EditableField
          label="Decision Maker Confirmed"
          value={deal.decision_maker_confirmed}
          type="checkbox"
          onSave={createFieldUpdater(deal.id, "decision_maker_confirmed")}
        />

        <EditableField
          label="Price Realistic?"
          value={deal.price_realistic}
          type="boolean"
          onSave={createFieldUpdater(deal.id, "price_realistic")}
        />
      </CardContent>
    </Card>
  );
}
