"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const [json, setJson] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    status: string;
    message: string;
  } | null>(null);

  const handleSubmit = async () => {
    setError("");
    setResult(null);

    // Validate JSON
    try {
      JSON.parse(json);
    } catch {
      setError("Invalid JSON format");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/sourcing-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteria: JSON.parse(json) }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to trigger sourcing agent");
        return;
      }

      setResult(data);
    } catch {
      setError("Failed to connect to API");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setJson("");
    setError("");
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>New Sourcing Criteria</DialogTitle>
          <DialogDescription>
            Paste buyer criteria JSON to trigger the sourcing agent and generate
            CoStar queries.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-4">
            <div className="rounded-md bg-muted p-4">
              <p className="font-medium text-green-600 mb-2">
                {result.status === "submitted" ? "Submitted" : result.status}
              </p>
              <p className="text-sm text-muted-foreground">{result.message}</p>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Close</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="criteria-json">Criteria JSON</Label>
                <Textarea
                  id="criteria-json"
                  placeholder='{"broker": {...}, "buyer": {...}, "criteria": {...}}'
                  value={json}
                  onChange={(e) => setJson(e.target.value)}
                  className="min-h-[300px] font-mono text-sm"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
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
