"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FileJson } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CoStarPayload } from "../../_lib/types";
import { isProcessing } from "../../_lib/utils";

interface StrategyTabProps {
  strategySummary: string | null;
  payloadsJson: CoStarPayload[] | null;
  status: string;
}

export function StrategyTab({ strategySummary, payloadsJson, status }: StrategyTabProps) {
  if (isProcessing(status)) {
    return <ProcessingState />;
  }

  return (
    <div className="space-y-6">
      <StrategySummaryCard summary={strategySummary} />
      <PayloadsCard payloads={payloadsJson} />
    </div>
  );
}

function ProcessingState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-12 px-4 border rounded-lg bg-muted/20 text-center">
      <div className="animate-pulse flex flex-col items-center">
        <FileJson className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/50 mb-4" aria-hidden="true" />
        <p className="text-sm sm:text-base text-muted-foreground">Generating strategy...</p>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          The sourcing agent is analyzing your criteria and building CoStar queries
        </p>
      </div>
    </div>
  );
}

function StrategySummaryCard({ summary }: { summary: string | null }) {
  if (!summary) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No strategy summary available yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Strategy Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="whitespace-pre-wrap text-sm font-sans">{summary}</pre>
      </CardContent>
    </Card>
  );
}

function PayloadsCard({ payloads }: { payloads: CoStarPayload[] | null }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (!payloads?.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No CoStar payloads generated yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>CoStar Query Payloads ({payloads.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {payloads.map((payload, i) => (
          <PayloadItem
            key={i}
            index={i}
            payload={payload}
            isExpanded={expanded.has(i)}
            onToggle={() => toggle(i)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

interface PayloadItemProps {
  index: number;
  payload: CoStarPayload;
  isExpanded: boolean;
  onToggle: () => void;
}

function PayloadItem({ index, payload, isExpanded, onToggle }: PayloadItemProps) {
  const name = payload.name ?? `Query ${index + 1}`;
  const Icon = isExpanded ? ChevronDown : ChevronRight;

  return (
    <div className="border rounded-lg">
      <Button variant="ghost" className="w-full justify-start px-3 sm:px-4 py-2 sm:py-3 h-auto" onClick={onToggle}>
        <Icon className="h-4 w-4 mr-2 shrink-0" aria-hidden="true" />
        <span className="font-medium text-sm sm:text-base truncate">{name}</span>
      </Button>
      {isExpanded && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4">
          <pre className="text-[10px] sm:text-xs bg-muted p-2 sm:p-3 rounded-md overflow-x-auto max-h-64 sm:max-h-96">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
