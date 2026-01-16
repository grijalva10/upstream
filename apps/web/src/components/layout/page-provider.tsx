"use client";

import { useLayoutEffect, type ReactNode } from "react";
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

  // Use layout effect to set context synchronously before paint
  useLayoutEffect(() => {
    if (!context) return;

    context.setPageContext({ title, description, breadcrumbs, actions });

    return () => {
      context.resetPageContext();
    };
    // Only re-run when title or description changes (primitives)
    // breadcrumbs and actions are captured in closure
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description]);

  return children;
}
