"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CallPrepPanelProps {
  callId: string;
  prepMd: string | null;
}

export function CallPrepPanel({ callId, prepMd }: CallPrepPanelProps) {
  const router = useRouter();
  const [regenerating, setRegenerating] = useState(false);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/calls/${callId}/prep`, { method: "POST" });
      if (res.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error("Error regenerating prep:", err);
    } finally {
      setRegenerating(false);
    }
  };

  // Simple markdown to HTML conversion for trusted content
  const renderMarkdown = (md: string) => {
    // Convert markdown headers
    let html = md
      .replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-lg font-semibold mt-6 mb-2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold mt-6 mb-3">$1</h1>')
      // Convert bold and italic
      .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      // Convert unordered lists with checkboxes
      .replace(/^- \[ \] (.*$)/gim, '<li class="flex items-start gap-2 ml-4"><input type="checkbox" disabled class="mt-1" /><span>$1</span></li>')
      .replace(/^- \[x\] (.*$)/gim, '<li class="flex items-start gap-2 ml-4"><input type="checkbox" checked disabled class="mt-1" /><span class="line-through text-muted-foreground">$1</span></li>')
      // Convert numbered lists
      .replace(/^\d+\. (.*$)/gim, '<li class="ml-6 list-decimal">$1</li>')
      // Convert unordered lists
      .replace(/^- (.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
      // Convert line breaks to paragraphs
      .replace(/\n\n/g, "</p><p class='my-2'>")
      // Convert single newlines to <br>
      .replace(/\n/g, "<br />");

    return `<div class="prose prose-sm max-w-none dark:prose-invert"><p class='my-2'>${html}</p></div>`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Call Prep
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRegenerate}
          disabled={regenerating}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${regenerating ? "animate-spin" : ""}`} />
          Regenerate
        </Button>
      </CardHeader>
      <CardContent>
        {prepMd ? (
          <div
            className="text-sm"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(prepMd) }}
          />
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No call prep generated yet</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={handleRegenerate}
              disabled={regenerating}
            >
              Generate Call Prep
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
