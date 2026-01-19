"use client";

import type { ReactNode } from "react";
import { PageProvider } from "@/components/layout";

interface PageSetupProps {
  children: ReactNode;
}

export function PageSetup({ children }: PageSetupProps): ReactNode {
  return (
    <PageProvider
      title="Leads"
      description="All sourced leads"
      breadcrumbs={[{ label: "Leads" }]}
    >
      {children}
    </PageProvider>
  );
}
