"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, FileJson, Play, AlertCircle, CheckCircle2, Square, Hash, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CoStarPayload } from "../../_lib/types";
import { isProcessing } from "../../_lib/utils";

interface StrategyTabProps {
  searchId: string;
  strategySummary: string | null;
  payloadsJson: CoStarPayload[] | null;
  status: string;
}

export function StrategyTab({ searchId, strategySummary, payloadsJson, status }: StrategyTabProps) {
  if (isProcessing(status)) {
    return <ProcessingState />;
  }

  return (
    <div className="space-y-6">
      <StrategySummaryCard summary={strategySummary} />
      <PayloadsCard searchId={searchId} payloads={payloadsJson} status={status} />
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
      <CardContent className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown>{summary}</ReactMarkdown>
      </CardContent>
    </Card>
  );
}

interface CoStarStatus {
  available: boolean;
  status: string;
  session_valid?: boolean;
  expires_in_minutes?: number;
  error?: string;
}

function getCoStarErrorMessage(status: CoStarStatus): string {
  if (status.status === "offline") {
    return "CoStar service not running. Start it with: python integrations/costar/service.py";
  }
  if (status.status !== "connected") {
    return `CoStar session not connected (${status.status}). Click Start in Settings > CoStar.`;
  }
  return "CoStar session expired. Please re-authenticate in Settings > CoStar.";
}

interface PayloadCount {
  payload_index: number;
  name: string;
  property_count: number;
  unit_count: number;
  shopping_center_count: number;
  space_count: number;
}

interface CountResult {
  counts: PayloadCount[];
  total_properties: number;
  payload_count: number;
}

function PayloadsCard({ searchId, payloads, status }: { searchId: string; payloads: CoStarPayload[] | null; status: string }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [costarStatus, setCostarStatus] = useState<CoStarStatus | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractSuccess, setExtractSuccess] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [maxProperties, setMaxProperties] = useState(20);

  // Count preview state
  const [countResult, setCountResult] = useState<CountResult | null>(null);
  const [isCounting, setIsCounting] = useState(false);
  const [countError, setCountError] = useState<string | null>(null);

  // Check CoStar service status on mount
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch(`/api/searches/${searchId}/run-extraction`);
        const data = await res.json();
        setCostarStatus(data);
      } catch {
        setCostarStatus({ available: false, status: "offline", error: "Failed to check status" });
      }
    }
    if (payloads?.length) {
      checkStatus();
    }
  }, [searchId, payloads]);

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

  const runExtraction = async () => {
    const controller = new AbortController();
    setAbortController(controller);
    setIsExtracting(true);
    setExtractError(null);
    setExtractSuccess(null);

    try {
      const res = await fetch(`/api/searches/${searchId}/run-extraction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max_properties: maxProperties }),
        signal: controller.signal,
      });

      const data = await res.json();

      if (!res.ok) {
        setExtractError(data.error || "Extraction failed");
        return;
      }

      setExtractSuccess(`Extracted ${data.properties} properties, ${data.companies} companies, ${data.contacts} contacts, ${data.loans || 0} loans`);
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setExtractError("Extraction cancelled");
      } else {
        setExtractError(String(err));
      }
    } finally {
      setIsExtracting(false);
      setAbortController(null);
    }
  };

  const stopExtraction = () => {
    if (abortController) {
      abortController.abort();
    }
  };

  const previewCounts = async () => {
    setIsCounting(true);
    setCountError(null);

    try {
      const res = await fetch(`/api/searches/${searchId}/count`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setCountError(data.error || "Failed to get counts");
        return;
      }

      setCountResult(data);
    } catch (err) {
      setCountError(String(err));
    } finally {
      setIsCounting(false);
    }
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

  const canExtract = costarStatus?.available && costarStatus?.status === "connected" && costarStatus?.session_valid;
  const isAlreadyExtracted = status === "extraction_complete" || status === "campaign_ready";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <CardTitle>CoStar Query Payloads ({payloads.length})</CardTitle>
          {countResult && (
            <span className="text-sm font-normal text-muted-foreground">
              • {countResult.total_properties.toLocaleString()} total properties
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {costarStatus && (
            <span className={`text-xs px-2 py-1 rounded ${
              costarStatus.status === "connected" && costarStatus.session_valid
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
            }`}>
              CoStar: {costarStatus.status}
              {costarStatus.expires_in_minutes ? ` (${costarStatus.expires_in_minutes}m)` : ""}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={previewCounts}
            disabled={isCounting || !canExtract}
          >
            {isCounting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Hash className="h-4 w-4 mr-2" />
            )}
            Preview
          </Button>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="max-properties" className="text-xs whitespace-nowrap">Max:</Label>
            <Input
              id="max-properties"
              type="number"
              min={1}
              max={1000}
              value={maxProperties}
              onChange={(e) => setMaxProperties(Number(e.target.value) || 20)}
              className="w-16 h-8 text-xs"
              disabled={isExtracting}
            />
          </div>
          {isExtracting ? (
            <Button size="sm" variant="destructive" onClick={stopExtraction}>
              <Square className="h-4 w-4 mr-2" />
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={runExtraction}
              disabled={!canExtract}
            >
              <Play className="h-4 w-4 mr-2" />
              {isAlreadyExtracted ? "Re-run" : "Run Extraction"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {extractError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{extractError}</AlertDescription>
          </Alert>
        )}
        {extractSuccess && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{extractSuccess}</AlertDescription>
          </Alert>
        )}
        {countError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{countError}</AlertDescription>
          </Alert>
        )}
        {!canExtract && costarStatus && !isAlreadyExtracted && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{getCoStarErrorMessage(costarStatus)}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          {payloads.map((payload, i) => (
            <PayloadItem
              key={i}
              index={i}
              payload={payload}
              isExpanded={expanded.has(i)}
              onToggle={() => toggle(i)}
              count={countResult?.counts[i]}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface PayloadItemProps {
  index: number;
  payload: CoStarPayload;
  isExpanded: boolean;
  onToggle: () => void;
  count?: PayloadCount;
}

function PayloadItem({ index, payload, isExpanded, onToggle, count }: PayloadItemProps) {
  const name = payload.name ?? `Query ${index + 1}`;
  const Icon = isExpanded ? ChevronDown : ChevronRight;

  return (
    <div className="border rounded-lg">
      <Button variant="ghost" className="w-full justify-between px-3 sm:px-4 py-2 sm:py-3 h-auto" onClick={onToggle}>
        <div className="flex items-center">
          <Icon className="h-4 w-4 mr-2 shrink-0" aria-hidden="true" />
          <span className="font-medium text-sm sm:text-base truncate">{name}</span>
        </div>
        {count && (
          <span className="text-xs text-muted-foreground ml-2 tabular-nums">
            {count.property_count.toLocaleString()} properties
          </span>
        )}
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
