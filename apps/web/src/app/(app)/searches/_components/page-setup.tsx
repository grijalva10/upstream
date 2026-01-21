"use client";

import type { ReactNode } from "react";
import { PageHeader, PageHeaderLeft, PageHeaderRight } from "@/components/layout";
import { SectionHeader } from "@/components/ui/section-header";
import { NewSearchDialog } from "./new-search-dialog";

interface PageSetupProps {
  children: ReactNode;
  count?: number;
}

export function PageSetup({ children, count }: PageSetupProps): ReactNode {
  return (
    <>
      <PageHeader>
        <PageHeaderLeft>
          <SectionHeader count={count}>Searches</SectionHeader>
        </PageHeaderLeft>
        <PageHeaderRight>
          <NewSearchDialog />
        </PageHeaderRight>
      </PageHeader>
      {children}
    </>
  );
}
