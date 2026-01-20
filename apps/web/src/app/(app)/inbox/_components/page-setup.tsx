"use client";

import type { ReactNode } from "react";
import { PageHeader, PageHeaderLeft } from "@/components/layout";
import { InboxHeader } from "./inbox-header";

interface PageSetupProps {
  children: ReactNode;
  counts: {
    inbox: number;
    future: number;
    archive: number;
  };
}

export function PageSetup({ children, counts }: PageSetupProps): ReactNode {
  return (
    <>
      <PageHeader>
        <PageHeaderLeft>
          <InboxHeader counts={counts} />
        </PageHeaderLeft>
      </PageHeader>
      {children}
    </>
  );
}
