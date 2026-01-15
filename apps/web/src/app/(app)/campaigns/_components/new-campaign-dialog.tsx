"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, CheckCircle, AlertCircle } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SearchOption {
  id: string;
  name: string;
}

interface NewCampaignDialogProps {
  searches: SearchOption[];
}

interface CreateResult {
  id: string;
  message: string;
}

export function NewCampaignDialog({ searches }: NewCampaignDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searchId, setSearchId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CreateResult | null>(null);

  const reset = () => {
    setSearchId("");
    setName("");
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

  const handleSearchChange = (value: string) => {
    setSearchId(value);
    const search = searches.find((s) => s.id === value);
    if (search && !name) {
      setName(`${search.name} Campaign`);
    }
  };

  const handleSubmit = async () => {
    setError("");

    if (!searchId) {
      setError("Please select a search");
      return;
    }

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search_id: searchId, name: name.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create campaign");
        return;
      }

      setResult(data);
    } catch {
      setError("Failed to connect to API");
    } finally {
      setLoading(false);
    }
  };

  const hasSearches = searches.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!hasSearches}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          New Campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-lg">
        <DialogHeader>
          <DialogTitle>New Campaign</DialogTitle>
          <DialogDescription>
            Create an email outreach campaign from a ready search.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <SuccessState
            result={result}
            onClose={handleClose}
            onView={() => {
              handleClose();
              router.push(`/campaigns/${result.id}`);
            }}
          />
        ) : (
          <FormState
            searches={searches}
            searchId={searchId}
            name={name}
            error={error}
            loading={loading}
            onSearchChange={handleSearchChange}
            onNameChange={setName}
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
          <CheckCircle className="h-5 w-5 text-green-600" aria-hidden="true" />
          <p className="font-medium text-green-600">Campaign Created!</p>
        </div>
        <p className="text-sm text-muted-foreground">{result.message}</p>
      </div>
      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
          Close
        </Button>
        <Button onClick={onView} className="w-full sm:w-auto">
          View Campaign
        </Button>
      </DialogFooter>
    </div>
  );
}

interface FormStateProps {
  searches: SearchOption[];
  searchId: string;
  name: string;
  error: string;
  loading: boolean;
  onSearchChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

function FormState({
  searches,
  searchId,
  name,
  error,
  loading,
  onSearchChange,
  onNameChange,
  onSubmit,
  onClose,
}: FormStateProps) {
  const canSubmit = searchId && name.trim() && !loading;

  return (
    <>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="campaign-search">Source Search</Label>
          <Select value={searchId} onValueChange={onSearchChange}>
            <SelectTrigger id="campaign-search">
              <SelectValue placeholder="Select a search..." />
            </SelectTrigger>
            <SelectContent>
              {searches.map((search) => (
                <SelectItem key={search.id} value={search.id}>
                  {search.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Only searches with status &quot;Ready&quot; are shown
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="campaign-name">Campaign Name</Label>
          <Input
            id="campaign-name"
            placeholder="e.g., Inland Empire Industrial Outreach"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            {error}
          </div>
        )}
      </div>
      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={!canSubmit} className="w-full sm:w-auto">
          {loading ? "Creating..." : "Create Campaign"}
        </Button>
      </DialogFooter>
    </>
  );
}
