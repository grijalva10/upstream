"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function NewCriteriaDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [json, setJson] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    status: string;
    message: string;
    clientId?: string;
    criteriaId?: string;
  } | null>(null);

  const handleSubmit = async () => {
    setError("");
    setResult(null);

    // Validate JSON
    let parsedJson;
    try {
      parsedJson = JSON.parse(json);
    } catch {
      setError("Invalid JSON format");
      return;
    }

    setLoading(true);

    try {
      console.log("Submitting criteria...", parsedJson);
      const response = await fetch("/api/sourcing-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteria: parsedJson }),
      });

      console.log("Response status:", response.status);
      const data = await response.json();
      console.log("Response data:", data);

      if (!response.ok) {
        setError(data.error || "Failed to trigger sourcing agent");
        setLoading(false);
        return;
      }

      setLoading(false);
      setResult(data);
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to connect to API");
      setLoading(false);
    }
  };

  const handleClose = () => {
    const hadResult = result !== null;
    setOpen(false);
    setJson("");
    setError("");
    setResult(null);
    // Refresh the page if we successfully created something
    if (hadResult) {
      router.refresh();
    }
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(json);
      setJson(JSON.stringify(parsed, null, 2));
      setError("");
    } catch {
      setError("Invalid JSON - cannot format");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Criteria
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>New Sourcing Criteria</DialogTitle>
          <DialogDescription>
            Paste buyer criteria JSON to trigger the sourcing agent and generate
            CoStar queries.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-4">
            <div className="rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <p className="font-medium text-green-600">
                  Successfully Created!
                </p>
              </div>
              <p className="text-sm text-muted-foreground">{result.message}</p>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Close & Refresh</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 py-4 overflow-hidden">
              <div className="space-y-2 h-full flex flex-col">
                <div className="flex items-center justify-between">
                  <Label htmlFor="criteria-json">Criteria JSON</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={formatJson}
                    disabled={!json.trim()}
                  >
                    Format JSON
                  </Button>
                </div>
                <Textarea
                  id="criteria-json"
                  placeholder={`{
  "buyer": {
    "name": "Company Name",
    "entity": { ... },
    "contact": { ... }
  },
  "broker": {
    "name": "Jeff Grijalva",
    ...
  },
  "criteria": {
    "name": "Search Name",
    "markets": [...],
    "propertyTypes": [...],
    ...
  }
}`}
                  value={json}
                  onChange={(e) => setJson(e.target.value)}
                  className="flex-1 min-h-[400px] font-mono text-sm resize-none"
                />
              </div>
              {error && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={loading || !json.trim()}>
                {loading ? "Processing..." : "Run Sourcing Agent"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
