"use client";

import type { ReactNode } from "react";
import { PageProvider } from "@/components/layout";

interface PageSetupProps {
  children: ReactNode;
  description?: string;
}

export function PageSetup({ children, description }: PageSetupProps): ReactNode {
  return (
    <PageProvider
      title="Command Center"
      description={description}
      breadcrumbs={[{ label: "Dashboard" }]}
    >
      {children}
    </PageProvider>
  );
}
