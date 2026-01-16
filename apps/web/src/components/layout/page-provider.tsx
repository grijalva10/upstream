"use client";

import { useEffect, type ReactNode } from "react";
import { usePageContext, type PageContextValue } from "@/lib/page-context";

interface PageProviderProps extends PageContextValue {
  children: ReactNode;
}

export function PageProvider({
  title,
  description,
  breadcrumbs,
  actions,
  children,
}: PageProviderProps): ReactNode {
  const context = usePageContext();

  useEffect(() => {
    if (!context) return;

    context.setPageContext({ title, description, breadcrumbs, actions });

    return () => {
      context.resetPageContext();
    };
  }, [context, title, description]);

  return children;
}
