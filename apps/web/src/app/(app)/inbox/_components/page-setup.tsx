"use client";

import type { ReactNode } from "react";
import { PageProvider } from "@/components/layout";

export function PageSetup({ children }: { children: ReactNode }): ReactNode {
  return (
    <PageProvider title="Inbox" breadcrumbs={[{ label: "Inbox" }]}>
      {children}
    </PageProvider>
  );
}
