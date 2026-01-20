"use client";

import type { ReactNode } from "react";
import { PageHeader, PageHeaderLeft, PageHeaderRight } from "@/components/layout";
import { QuickCreateLead } from "./quick-create-lead";

interface PageSetupProps {
  children: ReactNode;
  count: number;
}

export function PageSetup({ children, count }: PageSetupProps): ReactNode {
  return (
    <>
      <PageHeader>
        <PageHeaderLeft>
          <h1 className="text-lg font-semibold">Leads</h1>
          <span className="text-sm text-muted-foreground">
            {count.toLocaleString()}
          </span>
        </PageHeaderLeft>
        <PageHeaderRight>
          <QuickCreateLead />
        </PageHeaderRight>
      </PageHeader>
      {children}
    </>
  );
}
