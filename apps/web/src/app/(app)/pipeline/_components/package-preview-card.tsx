"use client";

import { useState, useTransition } from "react";
import { Package, Loader2, Download, Send, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateDeal, generatePackage } from "@/lib/deals/actions";
import { getQualificationProgress, isQualified } from "@/lib/deals/utils";
import type { Deal } from "@/lib/deals/schema";

interface PackagePreviewCardProps {
  deal: Deal;
}

export function PackagePreviewCard({ deal }: PackagePreviewCardProps) {
  const [isPending, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);

  // Local state for text areas (save on blur)
  const [summary, setSummary] = useState(deal.investment_summary ?? "");
  const [adminNotes, setAdminNotes] = useState(deal.admin_notes ?? "");
  const [highlights, setHighlights] = useState<string[]>(deal.investment_highlights ?? []);
  const [newHighlight, setNewHighlight] = useState("");

  const { completed, total } = getQualificationProgress(deal);
  const qualified = isQualified(deal);

  function handleSummaryBlur() {
    if (summary !== (deal.investment_summary ?? "")) {
      startTransition(async () => {
        await updateDeal(deal.id, { investment_summary: summary || null });
      });
    }
  }

  function handleAdminNotesBlur() {
    if (adminNotes !== (deal.admin_notes ?? "")) {
      startTransition(async () => {
        await updateDeal(deal.id, { admin_notes: adminNotes || null });
      });
    }
  }

  function addHighlight() {
    if (!newHighlight.trim()) return;

    const newHighlights = [...highlights, newHighlight.trim()];
    setHighlights(newHighlights);
    setNewHighlight("");

    startTransition(async () => {
      await updateDeal(deal.id, { investment_highlights: newHighlights });
    });
  }

  function removeHighlight(index: number) {
    const newHighlights = highlights.filter((_, i) => i !== index);
    setHighlights(newHighlights);

    startTransition(async () => {
      await updateDeal(deal.id, {
        investment_highlights: newHighlights.length > 0 ? newHighlights : null,
      });
    });
  }

  async function handleGeneratePackage() {
    setIsGenerating(true);
    try {
      const result = await generatePackage(deal.id);
      if (result.success && result.package) {
        // Download as JSON
        const blob = new Blob([JSON.stringify(result.package, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${deal.display_id}_package.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } finally {
      setIsGenerating(false);
    }
  }

  // Show disabled state if not qualified
  if (!qualified && deal.status === "qualifying") {
    return (
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Deal Package
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Complete qualification ({completed}/{total}) to package this deal.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Deal Package
          </CardTitle>
          {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Investment Summary */}
        <div className="space-y-1.5">
          <Label>Investment Summary</Label>
          <Textarea
            placeholder="Write a compelling investment summary..."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            onBlur={handleSummaryBlur}
            rows={4}
            disabled={isPending}
          />
        </div>

        {/* Investment Highlights */}
        <div className="space-y-2">
          <Label>Investment Highlights</Label>

          {highlights.length > 0 && (
            <ul className="space-y-2">
              {highlights.map((highlight, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between p-2 bg-muted rounded-md"
                >
                  <span className="text-sm">{highlight}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeHighlight(index)}
                    disabled={isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-2">
            <Input
              placeholder="Add a highlight..."
              value={newHighlight}
              onChange={(e) => setNewHighlight(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addHighlight();
                }
              }}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={addHighlight}
              disabled={!newHighlight.trim() || isPending}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Admin Notes */}
        <div className="space-y-1.5">
          <Label>Admin Notes (Internal)</Label>
          <Textarea
            placeholder="Internal notes about this deal..."
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            onBlur={handleAdminNotesBlur}
            rows={2}
            disabled={isPending}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2">
          <Button onClick={handleGeneratePackage} disabled={isGenerating || isPending}>
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Generate Package
          </Button>
          <Button variant="outline" disabled>
            <Send className="h-4 w-4 mr-2" />
            Export to lee-1031-x
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
