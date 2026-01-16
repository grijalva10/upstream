"use client";

import type { ReactNode } from "react";
import { PageProvider } from "@/components/layout";
import { NewCampaignDialog } from "./new-campaign-dialog";

interface PageSetupProps {
  children: ReactNode;
  searches: { id: string; name: string }[];
}

export function PageSetup({ children, searches }: PageSetupProps): ReactNode {
  return (
    <PageProvider
      title="Campaigns"
      description="Email outreach campaigns for your searches"
      breadcrumbs={[{ label: "Campaigns" }]}
      actions={<NewCampaignDialog searches={searches} />}
    >
      {children}
    </PageProvider>
  );
}
