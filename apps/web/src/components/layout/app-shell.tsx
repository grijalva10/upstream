"use client";

import type { ReactNode } from "react";
import { PageContextProvider } from "@/lib/page-context";
import { Sidebar } from "@/components/sidebar";
import { AppHeader } from "./app-header";
import { AISheetProvider, AISheet } from "@/components/ai-sheet";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps): ReactNode {
  return (
    <PageContextProvider>
      <AISheetProvider>
        <div className="h-screen flex overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <AppHeader />
            <main className="flex-1 min-h-0 overflow-y-auto bg-background">
              {children}
            </main>
          </div>
        </div>
        <AISheet />
      </AISheetProvider>
    </PageContextProvider>
  );
}
