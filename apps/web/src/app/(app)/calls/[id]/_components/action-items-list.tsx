"use client";

import { useState, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

interface ActionItem {
  id: string;
  text: string;
  completed: boolean;
}

interface ActionItemsListProps {
  callId: string;
  items: ActionItem[] | null;
}

export function ActionItemsList({ callId, items: initialItems }: ActionItemsListProps) {
  const [items, setItems] = useState<ActionItem[]>(initialItems || []);
  const [newItemText, setNewItemText] = useState("");
  const [saving, setSaving] = useState(false);

  const saveItems = useCallback(async (newItems: ActionItem[]) => {
    setSaving(true);
    try {
      await fetch(`/api/calls/${callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_items: newItems }),
      });
    } catch (err) {
      console.error("Error saving action items:", err);
    } finally {
      setSaving(false);
    }
  }, [callId]);

  const addItem = () => {
    if (!newItemText.trim()) return;

    const newItem: ActionItem = {
      id: crypto.randomUUID(),
      text: newItemText.trim(),
      completed: false,
    };

    const newItems = [...items, newItem];
    setItems(newItems);
    setNewItemText("");
    saveItems(newItems);
  };

  const toggleItem = (id: string) => {
    const newItems = items.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    setItems(newItems);
    saveItems(newItems);
  };

  const deleteItem = (id: string) => {
    const newItems = items.filter((item) => item.id !== id);
    setItems(newItems);
    saveItems(newItems);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addItem();
    }
  };

  const completedCount = items.filter((item) => item.completed).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Action Items</CardTitle>
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {completedCount}/{items.length} done
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 group"
            >
              <Checkbox
                checked={item.completed}
                onCheckedChange={() => toggleItem(item.id)}
                disabled={saving}
              />
              <span
                className={`flex-1 text-sm ${
                  item.completed ? "line-through text-muted-foreground" : ""
                }`}
              >
                {item.text}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => deleteItem(item.id)}
                disabled={saving}
              >
                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Input
            placeholder="Add action item..."
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="text-sm"
            disabled={saving}
          />
          <Button
            size="sm"
            onClick={addItem}
            disabled={!newItemText.trim() || saving}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
