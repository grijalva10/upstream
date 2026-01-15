"use client";

import { useState, useTransition } from "react";
import { FileText, ExternalLink, Plus, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EditableField } from "./editable-field";
import { updateDeal } from "@/lib/deals/actions";
import { createFieldUpdater } from "@/lib/deals/utils";
import type { Deal } from "@/lib/deals/schema";

interface DocumentsCardProps {
  deal: Deal;
}

export function DocumentsCard({ deal }: DocumentsCardProps) {
  const [isPending, startTransition] = useTransition();
  const [otherDocs, setOtherDocs] = useState(deal.other_docs ?? []);
  const [newDocName, setNewDocName] = useState("");
  const [newDocUrl, setNewDocUrl] = useState("");

  function addDoc() {
    if (!newDocName.trim() || !newDocUrl.trim()) return;

    const newDocs = [...otherDocs, { name: newDocName.trim(), url: newDocUrl.trim() }];
    setOtherDocs(newDocs);
    setNewDocName("");
    setNewDocUrl("");

    startTransition(async () => {
      await updateDeal(deal.id, { other_docs: newDocs });
    });
  }

  function removeDoc(index: number) {
    const newDocs = otherDocs.filter((_, i) => i !== index);
    setOtherDocs(newDocs);

    startTransition(async () => {
      await updateDeal(deal.id, { other_docs: newDocs.length > 0 ? newDocs : null });
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documents
          </CardTitle>
          {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <EditableField
          label="Rent Roll URL"
          value={deal.rent_roll_url}
          type="url"
          placeholder="https://..."
          onSave={createFieldUpdater(deal.id, "rent_roll_url")}
        />

        <EditableField
          label="Operating Statement URL"
          value={deal.operating_statement_url}
          type="url"
          placeholder="https://..."
          onSave={createFieldUpdater(deal.id, "operating_statement_url")}
        />

        {/* Other Documents List */}
        <div className="space-y-2">
          <Label>Other Documents</Label>

          {otherDocs.length > 0 && (
            <div className="space-y-2">
              {otherDocs.map((doc, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-muted rounded-md"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate text-sm">{doc.name}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" asChild>
                      <a href={doc.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeDoc(index)}
                      disabled={isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add new document */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                placeholder="Document name"
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Input
                placeholder="URL"
                value={newDocUrl}
                onChange={(e) => setNewDocUrl(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={addDoc}
              disabled={!newDocName.trim() || !newDocUrl.trim() || isPending}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
