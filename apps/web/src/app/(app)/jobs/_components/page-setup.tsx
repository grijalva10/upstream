"use client";

import type { ReactNode } from "react";
import { PageProvider } from "@/components/layout";

export function PageSetup({ children }: { children: ReactNode }): ReactNode {
  return (
    <PageProvider
      title="Jobs"
      description="Monitor email queue and background jobs"
      breadcrumbs={[{ label: "Jobs" }]}
    >
      {children}
    </PageProvider>
  );
}
