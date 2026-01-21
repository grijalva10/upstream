"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { SendHorizontal, Loader2, Sparkles, MessageSquare, Wrench, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAISheet } from "./ai-sheet-provider";
import { AIContextCard } from "./ai-context-card";
import type { Message, ToolActivity } from "./types";

interface StreamChunk {
  type: "text" | "tool_use" | "tool_result" | "error" | "done";
  content: string;
  tool?: string;
}

function ToolActivityIndicator({ activity }: { activity: ToolActivity[] }) {
  if (!activity || activity.length === 0) return null;

  const runningTools = activity.filter(t => t.status === 'running');
  const currentTool = runningTools[runningTools.length - 1];

  if (!currentTool) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
      <Wrench className="w-3 h-3 animate-pulse" />
      <span className="font-mono">{currentTool.tool}</span>
    </div>
  );
}

function ChatMessage({ message }: { message: Message }) {
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
      <div className={cn("flex-1 min-w-0 space-y-1", isUser && "text-right")}>
        <div
          className={cn(
            "inline-block rounded-2xl px-3.5 py-2 text-[13px] max-w-[88%] leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted/70 text-foreground rounded-bl-md"
          )}
        >
          <p className="whitespace-pre-wrap text-left">{message.content || (message.isStreaming ? "..." : "")}</p>
        </div>
        {message.toolActivity && message.toolActivity.length > 0 && (
          <div className={cn("max-w-[88%]", isUser ? "ml-auto" : "mr-auto")}>
            <div className="flex flex-wrap gap-1 mt-1">
              {message.toolActivity.map((t, i) => (
                <span
                  key={i}
                  className={cn(
                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono",
                    t.status === 'running'
                      ? "bg-amber-500/10 text-amber-600"
                      : "bg-green-500/10 text-green-600"
                  )}
                >
                  {t.status === 'running' ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ) : (
                    <Check className="w-2.5 h-2.5" />
                  )}
                  {t.tool}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AIChat() {
  const { context, setContext, messages, addMessage, updateMessage, isLoading, setIsLoading } = useAISheet();

  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

    // Create assistant message placeholder
    const assistantMsgId = addMessage({
      role: "assistant",
      content: "",
      isStreaming: true,
      toolActivity: []
    });

    // Abort any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

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
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedContent = "";
      let toolActivity: ToolActivity[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          try {
            const chunk: StreamChunk = JSON.parse(line.slice(6));

            switch (chunk.type) {
              case "text":
                accumulatedContent += chunk.content;
                updateMessage(assistantMsgId, {
                  content: accumulatedContent,
                  toolActivity: [...toolActivity],
                });
                break;

              case "tool_use":
                if (chunk.tool) {
                  toolActivity = [...toolActivity, { tool: chunk.tool, status: 'running' }];
                  updateMessage(assistantMsgId, {
                    content: accumulatedContent,
                    toolActivity: [...toolActivity],
                  });
                }
                break;

              case "tool_result":
                // Mark the last running tool as done
                const lastRunning = toolActivity.findIndex(t => t.status === 'running');
                if (lastRunning >= 0) {
                  toolActivity = toolActivity.map((t, i) =>
                    i === lastRunning ? { ...t, status: 'done' as const } : t
                  );
                  updateMessage(assistantMsgId, {
                    content: accumulatedContent,
                    toolActivity: [...toolActivity],
                  });
                }
                break;

              case "error":
                accumulatedContent += `\n\nError: ${chunk.content}`;
                updateMessage(assistantMsgId, {
                  content: accumulatedContent,
                  isStreaming: false,
                  toolActivity: [...toolActivity],
                });
                break;

              case "done":
                // Mark all tools as done
                toolActivity = toolActivity.map(t => ({ ...t, status: 'done' as const }));
                updateMessage(assistantMsgId, {
                  content: accumulatedContent || chunk.content || "Done.",
                  isStreaming: false,
                  toolActivity: [...toolActivity],
                });
                break;
            }
          } catch {
            // Skip malformed lines
          }
        }
      }

      // Finalize message
      updateMessage(assistantMsgId, {
        content: accumulatedContent || "Done.",
        isStreaming: false,
        toolActivity: toolActivity.map(t => ({ ...t, status: 'done' as const })),
      });

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return; // Request was cancelled
      }
      console.error("AI chat error:", error);
      updateMessage(assistantMsgId, {
        content: "Sorry, I encountered an error. Please try again.",
        isStreaming: false,
      });
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, context, isLoading, addMessage, updateMessage, setIsLoading]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
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
              <p className="text-sm font-medium">Full agentic mode</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                I can read files, query the database, run commands, and take actions
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))
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
          Enter to send • Ctrl+J to toggle
        </p>
      </div>
    </div>
  );
}
