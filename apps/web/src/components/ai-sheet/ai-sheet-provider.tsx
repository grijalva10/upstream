"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import type { AISheetContextValue, EntityContext, Message } from "./types";

const AISheetContext = createContext<AISheetContextValue | null>(null);

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function AISheetProvider({ children }: { children: ReactNode }): ReactNode {
  const [isOpen, setIsOpen] = useState(false);
  const [context, setContext] = useState<EntityContext | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const open = useCallback((newContext?: EntityContext) => {
    if (newContext) {
      setContext(newContext);
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const addMessage = useCallback((message: Omit<Message, 'id' | 'createdAt'>) => {
    const newMessage: Message = {
      ...message,
      id: generateId(),
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Global keyboard shortcut: Cmd+J (Mac) / Ctrl+J (Windows)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle]);

  const contextValue = useMemo<AISheetContextValue>(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      context,
      setContext,
      messages,
      addMessage,
      clearMessages,
      isLoading,
      setIsLoading,
    }),
    [isOpen, open, close, toggle, context, messages, addMessage, clearMessages, isLoading]
  );

  return (
    <AISheetContext.Provider value={contextValue}>
      {children}
    </AISheetContext.Provider>
  );
}

export function useAISheet(): AISheetContextValue {
  const context = useContext(AISheetContext);
  if (!context) {
    throw new Error("useAISheet must be used within an AISheetProvider");
  }
  return context;
}
