"use client";

import type { ReactNode } from "react";
import { PageHeader, PageHeaderLeft, PageHeaderRight } from "@/components/layout";
import { SectionHeader } from "@/components/ui/section-header";
import { NewCampaignDialog } from "./new-campaign-dialog";

interface PageSetupProps {
  children: ReactNode;
  searches: { id: string; name: string }[];
  count?: number;
}

export function PageSetup({ children, searches, count }: PageSetupProps): ReactNode {
  return (
    <>
      <PageHeader>
        <PageHeaderLeft>
          <SectionHeader count={count}>Campaigns</SectionHeader>
        </PageHeaderLeft>
        <PageHeaderRight>
          <NewCampaignDialog searches={searches} />
        </PageHeaderRight>
      </PageHeader>
      {children}
    </>
  );
}
