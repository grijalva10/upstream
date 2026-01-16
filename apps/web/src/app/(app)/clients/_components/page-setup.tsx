"use client";

import type { ReactNode } from "react";
import { PageProvider } from "@/components/layout";

export function PageSetup({ children }: { children: ReactNode }): ReactNode {
  return (
    <PageProvider
      title="Clients"
      description="Buyers and investors we source deals for"
      breadcrumbs={[{ label: "Clients" }]}
    >
      {children}
    </PageProvider>
  );
}
