"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Loader2, FileCode, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AgentRunnerProps {
  searchId: string;
  searchName: string;
  initialCriteria?: Record<string, unknown> | null;
}

export function AgentRunner({ searchId, searchName, initialCriteria }: AgentRunnerProps) {
  const router = useRouter();
  const [criteria, setCriteria] = useState(
    initialCriteria ? JSON.stringify(initialCriteria, null, 2) : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    success: boolean;
    output: string;
    execution_id?: string;
  } | null>(null);

  const formatJson = () => {
    try {
      setCriteria(JSON.stringify(JSON.parse(criteria), null, 2));
      setError("");
    } catch {
      setError("Invalid JSON - cannot format");
    }
  };

  const handleRun = async () => {
    setError("");
    setResult(null);

    // Validate JSON
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(criteria);
    } catch {
      setError("Invalid JSON format");
      return;
    }

    if (!parsed || Object.keys(parsed).length === 0) {
      setError("Criteria cannot be empty");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/searches/${searchId}/run-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteria_json: parsed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to run agent");
        setResult(data.output ? { success: false, output: data.output } : null);
        return;
      }

      setResult({
        success: data.success,
        output: data.output || "",
        execution_id: data.execution_id,
      });

      // Refresh to show updated status
      router.refresh();
    } catch (err) {
      setError("Failed to connect to API");
    } finally {
      setLoading(false);
    }
  };

  const canRun = criteria.trim() && !loading;

  return (
    <div className="space-y-6">
      {/* Criteria Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            Buyer Criteria
          </CardTitle>
          <CardDescription>
            Paste the buyer criteria JSON to generate CoStar query payloads
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="criteria-json">Criteria JSON</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={formatJson}
                disabled={!criteria.trim()}
              >
                Format
              </Button>
            </div>
            <Textarea
              id="criteria-json"
              placeholder={PLACEHOLDER}
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              className="min-h-[300px] font-mono text-sm resize-y"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
              <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleRun} disabled={!canRun} size="lg">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Agent...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Sourcing Agent
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Agent Output */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Agent Output
              {result.execution_id && (
                <span className="text-xs font-normal text-muted-foreground ml-auto">
                  Execution: {result.execution_id.slice(0, 8)}...
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {result.success
                ? "The sourcing agent completed successfully"
                : "The sourcing agent encountered an error"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4 max-h-[500px] overflow-auto">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {result.output || "(No output)"}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const PLACEHOLDER = `{
  "buyer": {
    "entityName": "ABC Investments LLC",
    "contact": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@abc.com"
    }
  },
  "criteria": {
    "markets": ["Los Angeles", "Orange County"],
    "propertyTypes": ["Industrial", "Office"],
    "priceMin": 5000000,
    "priceMax": 25000000,
    "strategies": ["core", "value_add"],
    "exchangeType": "1031",
    "deadline": "2026-06-30"
  }
}`;
