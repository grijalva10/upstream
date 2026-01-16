"use client";

import type { ReactNode } from "react";
import { PageProvider } from "@/components/layout";

export function PageSetup({ children }: { children: ReactNode }): ReactNode {
  return (
    <PageProvider
      title="Approval Queue"
      description="Review and approve AI-generated emails"
      breadcrumbs={[{ label: "Approvals" }]}
    >
      {children}
    </PageProvider>
  );
}
