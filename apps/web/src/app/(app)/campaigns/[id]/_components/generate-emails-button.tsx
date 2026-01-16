"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GenerateEmailsButtonProps {
  campaignId: string;
  disabled?: boolean;
}

export function GenerateEmailsButton({ campaignId, disabled }: GenerateEmailsButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const router = useRouter();

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setNotification(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/generate-emails`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate emails");
      }

      showNotification("success", "Emails generated successfully");
      router.refresh();
    } catch (error) {
      console.error("Generate emails error:", error);
      showNotification("error", error instanceof Error ? error.message : "Failed to generate emails");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleGenerate}
        disabled={disabled || isGenerating}
        className="gap-2"
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {isGenerating ? "Generating..." : "Generate"}
      </Button>

      {notification && (
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm animate-in fade-in slide-in-from-left-2 ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {notification.message}
        </div>
      )}
    </div>
  );
}
