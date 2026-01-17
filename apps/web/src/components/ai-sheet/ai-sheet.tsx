"use client";

import { Sparkles } from "lucide-react";
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
        className="w-full sm:max-w-md p-0 flex flex-col gap-0 border-l shadow-2xl"
        showCloseButton={true}
      >
        <SheetHeader className="flex-shrink-0 px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <SheetTitle className="text-sm font-semibold">AI Assistant</SheetTitle>
              <SheetDescription className="text-[11px] text-muted-foreground">
                Press Esc to close
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
