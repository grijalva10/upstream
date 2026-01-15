"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CallOutcomeBadge } from "../../_components/call-status-badge";

interface OutcomeSelectorProps {
  callId: string;
  currentOutcome: string | null;
  status: string;
}

const outcomes = [
  { value: "qualified", label: "Qualified", description: "Ready to package and hand off" },
  { value: "needs_followup", label: "Needs Follow-up", description: "More information or calls needed" },
  { value: "not_interested", label: "Not Interested", description: "Dead end, won't proceed" },
  { value: "reschedule", label: "Reschedule", description: "Need to call again later" },
];

export function OutcomeSelector({ callId, currentOutcome, status }: OutcomeSelectorProps) {
  const router = useRouter();
  const [outcome, setOutcome] = useState(currentOutcome || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!outcome) return;

    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch(`/api/calls/${callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        router.refresh();
      }
    } catch (err) {
      console.error("Error saving outcome:", err);
    } finally {
      setSaving(false);
    }
  };

  const isCompleted = status === "completed";
  const hasChanged = outcome !== (currentOutcome || "");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Call Outcome</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isCompleted ? (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">
              Complete the call to set an outcome
            </p>
          </div>
        ) : (
          <>
            {currentOutcome && !hasChanged && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Current:</span>
                <CallOutcomeBadge outcome={currentOutcome} />
              </div>
            )}

            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger>
                <SelectValue placeholder="Select outcome..." />
              </SelectTrigger>
              <SelectContent>
                {outcomes.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <div>
                      <span className="font-medium">{o.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {o.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              className="w-full"
              onClick={handleSave}
              disabled={!outcome || saving || !hasChanged}
            >
              {saving ? (
                "Saving..."
              ) : saved ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Saved
                </>
              ) : (
                "Save Outcome"
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
