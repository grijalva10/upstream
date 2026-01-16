"use client";

import type { ReactNode } from "react";
import { usePageContext } from "@/lib/page-context";
import { Breadcrumbs } from "./breadcrumbs";
import { HeaderActions } from "./header-actions";

export function AppHeader(): ReactNode {
  const pageContext = usePageContext();

  const showBreadcrumbs =
    pageContext?.breadcrumbs && pageContext.breadcrumbs.length > 1;

  return (
    <header className="h-14 border-b bg-background flex-shrink-0">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between">
        <div className="flex flex-col justify-center min-w-0">
          {pageContext?.title && (
            <h1 className="text-lg font-semibold tracking-tight truncate">
              {pageContext.title}
            </h1>
          )}
          {showBreadcrumbs && (
            <Breadcrumbs
              items={pageContext.breadcrumbs!}
              className="hidden sm:flex mt-0.5"
            />
          )}
        </div>

        <div className="flex items-center gap-4">
          {pageContext?.actions && (
            <div className="hidden sm:flex items-center">
              {pageContext.actions}
            </div>
          )}
          <HeaderActions />
        </div>
      </div>
    </header>
  );
}
