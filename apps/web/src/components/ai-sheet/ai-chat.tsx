"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { SendHorizontal, Loader2, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAISheet } from "./ai-sheet-provider";
import { AIContextCard } from "./ai-context-card";
import { AIActionCard } from "./ai-action-card";
import type { Message, SuggestedAction, EntityContext } from "./types";

interface ChatMessageProps {
  message: Message;
  onConfirmAction?: (action: SuggestedAction) => void;
  onRejectAction?: (action: SuggestedAction) => void;
  isExecutingAction?: boolean;
}

function ChatMessage({ message, onConfirmAction, onRejectAction, isExecutingAction }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {isUser ? "U" : <Sparkles className="w-3.5 h-3.5" />}
      </div>
      <div className={cn("flex-1 min-w-0 space-y-2", isUser && "text-right")}>
        <div
          className={cn(
            "inline-block rounded-lg px-3 py-2 text-sm max-w-[90%]",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground"
          )}
        >
          <p className="whitespace-pre-wrap text-left">{message.content}</p>
        </div>
        {message.action && !message.action.confirmed && onConfirmAction && onRejectAction && (
          <div className={cn("max-w-[90%]", isUser ? "ml-auto" : "mr-auto")}>
            <AIActionCard
              action={message.action}
              onConfirm={onConfirmAction}
              onReject={onRejectAction}
              isExecuting={isExecutingAction}
            />
          </div>
        )}
        {message.action?.confirmed && (
          <div className={cn("max-w-[90%]", isUser ? "ml-auto" : "mr-auto")}>
            <AIActionCard
              action={message.action}
              onConfirm={() => {}}
              onReject={() => {}}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function AIChat() {
  const {
    context,
    setContext,
    messages,
    addMessage,
    isLoading,
    setIsLoading,
  } = useAISheet();

  const [input, setInput] = useState("");
  const [executingAction, setExecutingAction] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus textarea when sheet opens
  useEffect(() => {
    const timeout = setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
    return () => clearTimeout(timeout);
  }, []);

  const sendMessage = useCallback(async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    // Add user message
    addMessage({
      role: "user",
      content: trimmedInput,
    });
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: trimmedInput }].map(m => ({
            role: m.role,
            content: m.content,
          })),
          context,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      addMessage({
        role: "assistant",
        content: data.message,
        action: data.action,
      });
    } catch (error) {
      console.error("AI chat error:", error);
      addMessage({
        role: "assistant",
        content: "Sorry, I encountered an error processing your request. Please try again.",
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

  const handleConfirmAction = useCallback(async (action: SuggestedAction) => {
    setExecutingAction(true);
    try {
      const response = await fetch("/api/ai/execute-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Update the action as confirmed
      // Since we can't directly mutate the message, we add a follow-up
      addMessage({
        role: "assistant",
        content: data.message || `${action.label} completed successfully.`,
        action: { ...action, confirmed: true },
      });
    } catch (error) {
      console.error("Action execution error:", error);
      addMessage({
        role: "assistant",
        content: "Sorry, I couldn't complete that action. Please try again.",
      });
    } finally {
      setExecutingAction(false);
    }
  }, [addMessage]);

  const handleRejectAction = useCallback((action: SuggestedAction) => {
    addMessage({
      role: "assistant",
      content: `Cancelled: ${action.label}. Let me know if you'd like to try something else.`,
    });
  }, [addMessage]);

  const clearContext = useCallback(() => {
    setContext(null);
  }, [setContext]);

  return (
    <div className="flex flex-col h-full">
      {/* Context Card */}
      {context && context.type && (
        <div className="flex-shrink-0 p-4 border-b">
          <AIContextCard context={context} onClear={clearContext} />
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">How can I help?</p>
              <p className="text-xs mt-1">
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
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Thinking...
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="flex-shrink-0 p-4 border-t bg-background">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="min-h-[44px] max-h-[120px] resize-none"
            rows={1}
            disabled={isLoading}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <SendHorizontal className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
