"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Play, RefreshCw } from "lucide-react";

interface CriteriaActionsProps {
  criteriaId: string;
  status: string;
  hasQueries: boolean;
}

export function CriteriaActions({
  criteriaId,
  status,
  hasQueries,
}: CriteriaActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateQueries = async () => {
    setLoading("generate");
    setError(null);

    try {
      const res = await fetch(`/api/criteria/${criteriaId}/generate-queries`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate queries");
      }

      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleRunExtraction = async () => {
    setLoading("extract");
    setError(null);

    try {
      const res = await fetch(`/api/criteria/${criteriaId}/extract`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to run extraction");
      }

      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  // Determine which buttons to show based on status
  const showGenerateButton = ["draft", "pending_review"].includes(status);
  const showExtractButton = hasQueries && ["pending_review", "approved", "active"].includes(status);
  const isGenerating = status === "generating";
  const isExtracting = status === "extracting";

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3">
        {/* Generate Queries Button */}
        {showGenerateButton && (
          <Button
            onClick={handleGenerateQueries}
            disabled={loading !== null || isGenerating}
            variant={hasQueries ? "outline" : "default"}
          >
            {loading === "generate" || isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : hasQueries ? (
              <RefreshCw className="h-4 w-4 mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {hasQueries ? "Regenerate Queries" : "Generate Queries"}
          </Button>
        )}

        {/* Run Extraction Button */}
        {showExtractButton && (
          <Button
            onClick={handleRunExtraction}
            disabled={loading !== null || isExtracting}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading === "extract" || isExtracting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run Extraction
          </Button>
        )}

        {/* Status indicators */}
        {isGenerating && (
          <span className="text-sm text-yellow-600">
            Generating queries...
          </span>
        )}
        {isExtracting && (
          <span className="text-sm text-orange-600">
            Extraction in progress...
          </span>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="mt-3 p-3 bg-red-100 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
