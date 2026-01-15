"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RetryButtonProps {
  searchId: string;
  status: string;
}

export function RetryButton({ searchId, status }: RetryButtonProps) {
  const router = useRouter();
  const [isRetrying, setIsRetrying] = useState(false);

  // Only show for pending or failed statuses
  if (!["pending_queries", "failed"].includes(status)) {
    return null;
  }

  async function handleRetry() {
    setIsRetrying(true);
    try {
      const response = await fetch(`/api/searches/${searchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry" }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to retry");
      }

      router.refresh();
    } catch (error) {
      console.error("Retry error:", error);
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRetry}
      disabled={isRetrying}
    >
      <RefreshCw className={`h-4 w-4 mr-1 ${isRetrying ? "animate-spin" : ""}`} />
      {isRetrying ? "Retrying..." : "Retry"}
    </Button>
  );
}
