"use client";

import type { ReactNode } from "react";
import { PageProvider } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function PageSetup({ children }: { children: ReactNode }): ReactNode {
  return (
    <PageProvider
      title="People"
      description="Contacts, buyers, brokers, and team members"
      breadcrumbs={[{ label: "People" }]}
      actions={
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Contact
        </Button>
      }
    >
      {children}
    </PageProvider>
  );
}
