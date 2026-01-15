"use client";

import { useState, useTransition } from "react";
import { StickyNote, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { addNote } from "@/lib/deals/actions";

interface AddNoteFormProps {
  dealId: string;
}

export function AddNoteForm({ dealId }: AddNoteFormProps) {
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!note.trim()) return;

    setError(null);
    startTransition(async () => {
      const result = await addNote(dealId, note);
      if (result.success) {
        setNote("");
      } else {
        setError(result.error ?? "Failed to add note");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StickyNote className="h-5 w-5" />
          Add Note
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
            {error}
          </div>
        )}

        <Textarea
          placeholder="Write a note about this deal..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          disabled={isPending}
        />

        <Button
          onClick={handleSubmit}
          disabled={isPending || !note.trim()}
          className="w-full"
        >
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Add Note
        </Button>
      </CardContent>
    </Card>
  );
}
