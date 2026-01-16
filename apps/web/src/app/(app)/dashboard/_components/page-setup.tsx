"use client";

import { useState, useEffect, type ReactNode } from "react";
import { PageProvider } from "@/components/layout";

interface PageSetupProps {
  children: ReactNode;
}

export function PageSetup({ children }: PageSetupProps): ReactNode {
  const [today, setToday] = useState<string>("");

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    );
  }, []);

  return (
    <PageProvider
      title="Command Center"
      description={today}
      breadcrumbs={[{ label: "Dashboard" }]}
    >
      {children}
    </PageProvider>
  );
}
