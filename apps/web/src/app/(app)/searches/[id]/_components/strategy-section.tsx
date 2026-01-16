"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Play, Square, Loader2, FileJson, AlertCircle, CheckCircle2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { CoStarPayload } from "../../_lib/types";
import { isProcessing } from "../../_lib/utils";

interface StrategySectionProps {
  searchId: string;
  strategySummary: string | null;
  payloadsJson: CoStarPayload[] | null;
  status: string;
}

interface CoStarStatus {
  available: boolean;
  status: string;
  session_valid?: boolean;
  expires_in_minutes?: number;
}

interface PayloadCount {
  payload_index: number;
  name: string;
  property_count: number;
}

interface CountResult {
  counts: PayloadCount[];
  total_properties: number;
}

export function StrategySection({ searchId, strategySummary, payloadsJson, status }: StrategySectionProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [costarStatus, setCostarStatus] = useState<CoStarStatus | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState<{ success: boolean; message: string } | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [maxProperties, setMaxProperties] = useState(20);
  const [countResult, setCountResult] = useState<CountResult | null>(null);
  const [isCounting, setIsCounting] = useState(false);

  // Check CoStar status on mount
  useEffect(() => {
    if (payloadsJson?.length) {
      fetch(`/api/searches/${searchId}/run-extraction`)
        .then((res) => res.json())
        .then(setCostarStatus)
        .catch(() => setCostarStatus({ available: false, status: "offline" }));
    }
  }, [searchId, payloadsJson]);

  const toggle = (index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const previewCounts = async () => {
    setIsCounting(true);
    try {
      const res = await fetch(`/api/searches/${searchId}/count`, { method: "POST" });
      const data = await res.json();
      if (res.ok) setCountResult(data);
    } finally {
      setIsCounting(false);
    }
  };

  const runExtraction = async () => {
    const controller = new AbortController();
    setAbortController(controller);
    setIsExtracting(true);
    setExtractResult(null);

    try {
      const res = await fetch(`/api/searches/${searchId}/run-extraction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max_properties: maxProperties }),
        signal: controller.signal,
      });
      const data = await res.json();

      if (!res.ok) {
        setExtractResult({ success: false, message: data.error || "Extraction failed" });
      } else {
        setExtractResult({
          success: true,
          message: `Extracted ${data.properties} properties, ${data.companies} companies, ${data.contacts} contacts`,
        });
        router.refresh();
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setExtractResult({ success: false, message: "Cancelled" });
      }
    } finally {
      setIsExtracting(false);
      setAbortController(null);
    }
  };

  const stopExtraction = () => abortController?.abort();

  // Processing state
  if (isProcessing(status)) {
    return (
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Strategy</h2>
        <div className="flex items-center gap-3 py-8 justify-center border rounded-lg bg-muted/30">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Generating strategy...</span>
        </div>
      </section>
    );
  }

  // No strategy yet
  if (!strategySummary && !payloadsJson?.length) {
    return (
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Strategy</h2>
        <div className="py-8 text-center border rounded-lg bg-muted/30">
          <p className="text-sm text-muted-foreground">No strategy generated yet</p>
        </div>
      </section>
    );
  }

  const canExtract = costarStatus?.available && costarStatus?.status === "connected" && costarStatus?.session_valid;

  return (
    <section className="space-y-6">
      {/* Strategy Summary */}
      {strategySummary && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Strategy Summary</h2>
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0">
            <ReactMarkdown>{strategySummary}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Payloads */}
      {payloadsJson && payloadsJson.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                CoStar Queries ({payloadsJson.length})
              </h2>
              {countResult && (
                <span className="text-xs text-muted-foreground">
                  {countResult.total_properties.toLocaleString()} total
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* CoStar Status */}
              {costarStatus && (
                <Badge
                  variant={canExtract ? "default" : "secondary"}
                  className="text-xs font-normal"
                >
                  {canExtract ? "CoStar Ready" : `CoStar ${costarStatus.status}`}
                  {costarStatus.expires_in_minutes && ` (${costarStatus.expires_in_minutes}m)`}
                </Badge>
              )}

              {/* Preview */}
              <Button
                size="sm"
                variant="ghost"
                onClick={previewCounts}
                disabled={isCounting || !canExtract}
              >
                {isCounting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Preview"}
              </Button>

              {/* Max input */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Max:</span>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={maxProperties}
                  onChange={(e) => setMaxProperties(Number(e.target.value) || 20)}
                  className="w-16 h-7 text-xs"
                  disabled={isExtracting}
                />
              </div>

              {/* Extract */}
              {isExtracting ? (
                <Button size="sm" variant="destructive" onClick={stopExtraction}>
                  <Square className="h-3.5 w-3.5 mr-1.5" />
                  Stop
                </Button>
              ) : (
                <Button size="sm" onClick={runExtraction} disabled={!canExtract}>
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Extract
                </Button>
              )}
            </div>
          </div>

          {/* Result message */}
          {extractResult && (
            <div
              className={`flex items-center gap-2 text-sm mb-3 px-3 py-2 rounded-md ${
                extractResult.success
                  ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                  : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
              }`}
            >
              {extractResult.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {extractResult.message}
            </div>
          )}

          {/* Payload list */}
          <div className="border rounded-lg divide-y">
            {payloadsJson.map((payload, i) => {
              const name = payload.name ?? `Query ${i + 1}`;
              const isOpen = expanded.has(i);
              const count = countResult?.counts[i]?.property_count;

              return (
                <div key={i}>
                  <button
                    onClick={() => toggle(i)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">{name}</span>
                    </div>
                    {count !== undefined && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {count.toLocaleString()} properties
                      </span>
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3">
                      <pre className="text-xs bg-muted/50 p-3 rounded-md overflow-x-auto max-h-64 font-mono">
                        {JSON.stringify(payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
