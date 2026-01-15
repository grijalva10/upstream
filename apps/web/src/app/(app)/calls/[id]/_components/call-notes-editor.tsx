"use client";

import { useState, useEffect, useCallback } from "react";
import { Save, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface CallNotesEditorProps {
  callId: string;
  initialNotes: string | null;
}

export function CallNotesEditor({ callId, initialNotes }: CallNotesEditorProps) {
  const [notes, setNotes] = useState(initialNotes || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lastSaved, setLastSaved] = useState(initialNotes || "");

  const saveNotes = useCallback(async (value: string) => {
    if (value === lastSaved) return;

    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch(`/api/calls/${callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes_md: value }),
      });

      if (res.ok) {
        setLastSaved(value);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error("Error saving notes:", err);
    } finally {
      setSaving(false);
    }
  }, [callId, lastSaved]);

  // Debounced auto-save
  useEffect(() => {
    const timer = setTimeout(() => {
      if (notes !== lastSaved) {
        saveNotes(notes);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [notes, lastSaved, saveNotes]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Post-Call Notes</CardTitle>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {saving && (
            <>
              <Save className="h-4 w-4 animate-pulse" />
              <span>Saving...</span>
            </>
          )}
          {saved && (
            <>
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-green-600">Saved</span>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="Add your notes from the call here..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[200px] resize-none"
        />
        <p className="text-xs text-muted-foreground mt-2">
          Notes are saved automatically as you type
        </p>
      </CardContent>
    </Card>
  );
}
