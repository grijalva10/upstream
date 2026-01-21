"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const shortcuts = [
  { key: "a", description: "Focus attention" },
  { key: "p", description: "Go to pipeline" },
  { key: "c", description: "Go to campaigns" },
  { key: "s", description: "Go to searches" },
  { key: "l", description: "Go to leads" },
  { key: "i", description: "Go to inbox" },
  { key: "r", description: "Refresh dashboard" },
  { key: "?", description: "Show shortcuts" },
];

interface KeyboardShortcutsProps {
  onRefresh?: () => void;
}

export function KeyboardShortcuts({ onRefresh }: KeyboardShortcutsProps) {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Ignore if modifier keys are pressed (except shift for ?)
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "p":
          e.preventDefault();
          router.push("/pipeline");
          break;
        case "c":
          e.preventDefault();
          router.push("/campaigns");
          break;
        case "s":
          e.preventDefault();
          router.push("/searches");
          break;
        case "l":
          e.preventDefault();
          router.push("/leads");
          break;
        case "i":
          e.preventDefault();
          router.push("/inbox");
          break;
        case "r":
          e.preventDefault();
          onRefresh?.();
          break;
        case "?":
          e.preventDefault();
          setShowHelp(true);
          break;
        case "escape":
          setShowHelp(false);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, onRefresh]);

  return (
    <Dialog open={showHelp} onOpenChange={setShowHelp}>
      <DialogContent className="sm:max-w-[300px]">
        <DialogHeader>
          <DialogTitle className="text-sm">Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {shortcuts.map((shortcut) => (
            <div key={shortcut.key} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{shortcut.description}</span>
              <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
