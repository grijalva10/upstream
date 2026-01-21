"use client";

import type { ReactNode } from "react";
import { PageHeader, PageHeaderLeft, PageHeaderRight } from "@/components/layout";
import { SectionHeader } from "@/components/ui/section-header";
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
          <SectionHeader count={count}>Leads</SectionHeader>
        </PageHeaderLeft>
        <PageHeaderRight>
          <QuickCreateLead />
        </PageHeaderRight>
      </PageHeader>
      {children}
    </>
  );
}
