"use client";

import type { ReactNode } from "react";
import { PageProvider } from "@/components/layout";
import { ScheduleCallDialog } from "./schedule-call-dialog";

interface PageSetupProps {
  children: ReactNode;
  description?: string;
}

export function PageSetup({ children, description }: PageSetupProps): ReactNode {
  return (
    <PageProvider
      title="Calls"
      description={description}
      breadcrumbs={[{ label: "Calls" }]}
      actions={<ScheduleCallDialog />}
    >
      {children}
    </PageProvider>
  );
}
