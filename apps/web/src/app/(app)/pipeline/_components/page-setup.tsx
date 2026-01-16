"use client";

import type { ReactNode } from "react";
import { PageProvider } from "@/components/layout";
import { NewDealDialog } from "./new-deal-dialog";

export function PageSetup({ children }: { children: ReactNode }): ReactNode {
  return (
    <PageProvider
      title="Pipeline"
      description="Track deals through qualification"
      breadcrumbs={[{ label: "Pipeline" }]}
      actions={<NewDealDialog />}
    >
      {children}
    </PageProvider>
  );
}
