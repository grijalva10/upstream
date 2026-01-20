"use client";

import type { ReactNode } from "react";
import { PageProvider } from "@/components/layout";

interface PageSetupProps {
  children: ReactNode;
}

export function PageSetup({ children }: PageSetupProps): ReactNode {
  return (
    <PageProvider
      title="Inbox"
      description="Tasks that need your attention"
      breadcrumbs={[{ label: "Inbox" }]}
    >
      {children}
    </PageProvider>
  );
}
