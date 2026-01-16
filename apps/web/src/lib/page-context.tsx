"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageContextValue {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
}

interface PageContextState extends PageContextValue {
  setPageContext: (value: Partial<PageContextValue>) => void;
  resetPageContext: () => void;
}

const defaultState: PageContextValue = {
  title: "",
  description: undefined,
  breadcrumbs: undefined,
  actions: undefined,
};

const PageContext = createContext<PageContextState | null>(null);

export function PageContextProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [state, setState] = useState<PageContextValue>(defaultState);

  const setPageContext = useCallback((value: Partial<PageContextValue>) => {
    setState((prev) => ({ ...prev, ...value }));
  }, []);

  const resetPageContext = useCallback(() => {
    setState(defaultState);
  }, []);

  return (
    <PageContext.Provider value={{ ...state, setPageContext, resetPageContext }}>
      {children}
    </PageContext.Provider>
  );
}

export function usePageContext(): PageContextState | null {
  return useContext(PageContext);
}
