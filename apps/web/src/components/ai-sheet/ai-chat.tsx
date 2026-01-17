"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { SendHorizontal, Loader2, Sparkles, MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAISheet } from "./ai-sheet-provider";
import { AIContextCard } from "./ai-context-card";
import { AIActionCard } from "./ai-action-card";
import type { Message, SuggestedAction } from "./types";

function ChatMessage({
  message,
  onConfirmAction,
  onRejectAction,
  isExecutingAction,
}: {
  message: Message;
  onConfirmAction: (action: SuggestedAction) => void;
  onRejectAction: (action: SuggestedAction) => void;
  isExecutingAction?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2.5", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-gradient-to-br from-primary/20 to-primary/5 text-primary"
        )}
      >
        {isUser ? "Y" : <Sparkles className="w-3 h-3" />}
      </div>
      <div className={cn("flex-1 min-w-0 space-y-2", isUser && "text-right")}>
        <div
          className={cn(
            "inline-block rounded-2xl px-3.5 py-2 text-[13px] max-w-[88%] leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted/70 text-foreground rounded-bl-md"
          )}
        >
          <p className="whitespace-pre-wrap text-left">{message.content}</p>
        </div>
        {message.action && (
          <div className={cn("max-w-[88%]", isUser ? "ml-auto" : "mr-auto")}>
            <AIActionCard
              action={message.action}
              onConfirm={onConfirmAction}
              onReject={onRejectAction}
              isExecuting={isExecutingAction}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function AIChat() {
  const { context, setContext, messages, addMessage, isLoading, setIsLoading } = useAISheet();

  const [input, setInput] = useState("");
  const [executingAction, setExecutingAction] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const timeout = setTimeout(() => textareaRef.current?.focus(), 100);
    return () => clearTimeout(timeout);
  }, []);

  const sendMessage = useCallback(async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    addMessage({ role: "user", content: trimmedInput });
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: trimmedInput }].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      addMessage({ role: "assistant", content: data.message, action: data.action });
    } catch (error) {
      console.error("AI chat error:", error);
      addMessage({
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, context, isLoading, addMessage, setIsLoading]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  const handleConfirmAction = useCallback(
    async (action: SuggestedAction) => {
      setExecutingAction(true);
      try {
        const response = await fetch("/api/ai/execute-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        addMessage({
          role: "assistant",
          content: data.message || `${action.label} completed.`,
          action: { ...action, confirmed: true },
        });
      } catch (error) {
        console.error("Action execution error:", error);
        addMessage({
          role: "assistant",
          content: "Couldn't complete that action. Please try again.",
        });
      } finally {
        setExecutingAction(false);
      }
    },
    [addMessage]
  );

  const handleRejectAction = useCallback(
    (action: SuggestedAction) => {
      addMessage({
        role: "assistant",
        content: `Cancelled. Let me know if you need something else.`,
      });
    },
    [addMessage]
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {context?.type && (
        <div className="flex-shrink-0 p-3 border-b bg-muted/20">
          <AIContextCard context={context} onClear={() => setContext(null)} />
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm font-medium">How can I help?</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                Paste notes, ask questions, or request actions
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onConfirmAction={handleConfirmAction}
                onRejectAction={handleRejectAction}
                isExecutingAction={executingAction}
              />
            ))
          )}
          {isLoading && (
            <div className="flex gap-2.5">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-primary animate-pulse" />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="flex-shrink-0 p-3 border-t bg-muted/20">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            className="min-h-[40px] max-h-[100px] resize-none text-sm rounded-xl border-muted-foreground/20 focus-visible:ring-1"
            rows={1}
            disabled={isLoading}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 rounded-xl h-10 w-10"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <SendHorizontal className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-1.5 text-center">
          Enter to send
        </p>
      </div>
    </div>
  );
}
