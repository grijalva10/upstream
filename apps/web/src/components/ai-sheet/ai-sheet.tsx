"use client";

import { Sparkles, Command } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useAISheet } from "./ai-sheet-provider";
import { AIChat } from "./ai-chat";

export function AISheet() {
  const { isOpen, close } = useAISheet();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col"
        showCloseButton={true}
      >
        <SheetHeader className="flex-shrink-0 px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-base">AI Assistant</SheetTitle>
              <SheetDescription className="text-xs flex items-center gap-1">
                <Command className="w-3 h-3" />
                <span>J to toggle</span>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <div className="flex-1 min-h-0">
          <AIChat />
        </div>
      </SheetContent>
    </Sheet>
  );
}
