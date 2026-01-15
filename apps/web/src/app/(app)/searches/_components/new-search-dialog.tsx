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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateResult {
  id: string;
  status: string;
  message: string;
}

export function NewSearchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [source, setSource] = useState("manual");
  const [json, setJson] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CreateResult | null>(null);

  const reset = () => {
    setName("");
    setSource("manual");
    setJson("");
    setError("");
    setResult(null);
  };

  const handleClose = () => {
    const shouldRefresh = result !== null;
    setOpen(false);
    reset();
    if (shouldRefresh) {
      router.refresh();
    }
  };

  const formatJson = () => {
    try {
      setJson(JSON.stringify(JSON.parse(json), null, 2));
      setError("");
    } catch {
      setError("Invalid JSON - cannot format");
    }
  };

  const handleSubmit = async () => {
    setError("");

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      setError("Invalid JSON format");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), source, criteria_json: parsed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create search");
        return;
      }

      setResult(data);
    } catch {
      setError("Failed to connect to API");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Search
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>New Search</DialogTitle>
          <DialogDescription>Create a new property search by pasting buyer criteria JSON.</DialogDescription>
        </DialogHeader>

        {result ? (
          <SuccessState result={result} onClose={handleClose} onView={() => {
            handleClose();
            router.push(`/searches/${result.id}`);
          }} />
        ) : (
          <FormState
            name={name}
            source={source}
            json={json}
            error={error}
            loading={loading}
            onNameChange={setName}
            onSourceChange={setSource}
            onJsonChange={setJson}
            onFormat={formatJson}
            onSubmit={handleSubmit}
            onClose={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface SuccessStateProps {
  result: CreateResult;
  onClose: () => void;
  onView: () => void;
}

function SuccessState({ result, onClose, onView }: SuccessStateProps) {
  return (
    <div className="space-y-4 py-4">
      <div className="rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <p className="font-medium text-green-600">Search Created!</p>
        </div>
        <p className="text-sm text-muted-foreground">{result.message}</p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Close</Button>
        <Button onClick={onView}>View Search</Button>
      </DialogFooter>
    </div>
  );
}

interface FormStateProps {
  name: string;
  source: string;
  json: string;
  error: string;
  loading: boolean;
  onNameChange: (v: string) => void;
  onSourceChange: (v: string) => void;
  onJsonChange: (v: string) => void;
  onFormat: () => void;
  onSubmit: () => void;
  onClose: () => void;
}

function FormState({
  name, source, json, error, loading,
  onNameChange, onSourceChange, onJsonChange,
  onFormat, onSubmit, onClose,
}: FormStateProps) {
  const canSubmit = name.trim() && json.trim() && !loading;

  return (
    <>
      <div className="flex-1 space-y-4 py-4 overflow-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="search-name">Search Name</Label>
            <Input
              id="search-name"
              placeholder="e.g., Inland Empire Industrial Q1"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="search-source">Source</Label>
            <Select value={source} onValueChange={onSourceChange}>
              <SelectTrigger id="search-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="lee-1031-x">Lee 1031-X</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="criteria-json">Criteria JSON</Label>
            <Button type="button" variant="ghost" size="sm" onClick={onFormat} disabled={!json.trim()}>
              Format
            </Button>
          </div>
          <Textarea
            id="criteria-json"
            placeholder={PLACEHOLDER}
            value={json}
            onChange={(e) => onJsonChange(e.target.value)}
            className="min-h-[250px] sm:min-h-[350px] font-mono text-xs sm:text-sm resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">{error}</p>
        )}
      </div>
      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
        <Button onClick={onSubmit} disabled={!canSubmit} className="w-full sm:w-auto">
          {loading ? "Creating..." : "Create Search"}
        </Button>
      </DialogFooter>
    </>
  );
}

const PLACEHOLDER = `{
  "buyer": {
    "name": "Company Name",
    "entity": { ... },
    "contact": { ... }
  },
  "criteria": {
    "markets": ["Inland Empire", "Los Angeles"],
    "propertyTypes": ["Industrial", "Office"],
    "priceRange": { "min": 5000000, "max": 25000000 }
  }
}`;
