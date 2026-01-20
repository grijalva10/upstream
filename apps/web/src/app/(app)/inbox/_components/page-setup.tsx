"use client";

import type { ReactNode } from "react";
import { PageProvider } from "@/components/layout";
import { InboxHeader } from "./inbox-header";

interface PageSetupProps {
  children: ReactNode;
  counts: {
    inbox: number;
    future: number;
    archive: number;
  };
}

export function PageSetup({ children, counts }: PageSetupProps): ReactNode {
  return (
    <PageProvider
      title={<InboxHeader counts={counts} />}
      breadcrumbs={[{ label: "Inbox" }]}
    >
      {children}
    </PageProvider>
  );
}
