"use client";

import type { ReactNode } from "react";
import { PageProvider } from "@/components/layout";

export function PageSetup({ children }: { children: ReactNode }): ReactNode {
  return (
    <PageProvider
      title="Orchestrator Health"
      description="Monitor the status of background loops and agent executions"
      breadcrumbs={[{ label: "Orchestrator" }]}
    >
      {children}
    </PageProvider>
  );
}
