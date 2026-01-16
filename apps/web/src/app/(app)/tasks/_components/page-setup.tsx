"use client";

import type { ReactNode } from "react";
import { PageProvider } from "@/components/layout";

export function PageSetup({ children }: { children: ReactNode }): ReactNode {
  return (
    <PageProvider
      title="Tasks"
      description="Calls, follow-ups, and action items"
      breadcrumbs={[{ label: "Tasks" }]}
    >
      {children}
    </PageProvider>
  );
}
