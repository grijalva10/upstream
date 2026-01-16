"use client";

import type { ReactNode } from "react";
import { PageProvider } from "@/components/layout";
import { NewSearchDialog } from "./new-search-dialog";

export function PageSetup({ children }: { children: ReactNode }): ReactNode {
  return (
    <PageProvider
      title="Searches"
      description="Create and manage property searches from buyer criteria"
      breadcrumbs={[{ label: "Searches" }]}
      actions={<NewSearchDialog />}
    >
      {children}
    </PageProvider>
  );
}
