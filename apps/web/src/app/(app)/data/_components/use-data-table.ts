"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export interface Column<T> {
  id: string;
  header: string;
  accessorKey?: keyof T;
  accessorFn?: (row: T) => unknown;
  cell?: (value: unknown, row: T) => React.ReactNode;
  enableSorting?: boolean;
  enableHiding?: boolean;
  defaultHidden?: boolean;
  align?: "left" | "center" | "right";
  className?: string;
}

export interface Filter {
  id: string;
  label: string;
  options: { value: string; label: string }[];
}

/** Extracts value from row using column accessor - shared by data-table and CSV export */
export function getColumnValue<T>(column: Column<T>, row: T): unknown {
  if (column.accessorFn) {
    return column.accessorFn(row);
  }
  if (column.accessorKey) {
    return row[column.accessorKey];
  }
  return null;
}

interface UseDataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  filters?: Filter[];
  endpoint?: string;
  dataKey?: string;
  initialTotal?: number;
  pageSize?: number;
}

interface UseDataTableReturn<T> {
  // Data
  rows: T[];
  total: number;
  loading: boolean;

  // Columns
  visibleColumns: Column<T>[];
  columnVisibility: Record<string, boolean>;
  toggleColumn: (id: string) => void;

  // Selection
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  clearSelection: () => void;

  // Filters
  filters: Filter[];
  filterValues: Record<string, string>;
  setFilter: (id: string, value: string) => void;
  clearFilters: () => void;
  activeFilterCount: number;

  // Search
  search: string;
  setSearch: (value: string) => void;

  // Sorting
  sortBy: string | null;
  sortDesc: boolean;
  setSort: (column: string) => void;

  // Pagination
  page: number;
  pageSize: number;
  totalPages: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;

  // Actions
  refresh: () => void;
  exportCsv: (filename: string) => void;
}

export function useDataTable<T extends { id: string }>({
  data: initialData,
  columns,
  filters = [],
  endpoint,
  dataKey = "data",
  initialTotal,
  pageSize: defaultPageSize = 20,
}: UseDataTableProps<T>): UseDataTableReturn<T> {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State
  const [data, setData] = useState<T[]>(initialData);
  const [total, setTotal] = useState(initialTotal ?? initialData.length);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // URL-synced state
  const page = Number(searchParams.get("page")) || 1;
  const pageSize = Number(searchParams.get("limit")) || defaultPageSize;
  const search = searchParams.get("q") || "";
  const sortBy = searchParams.get("sort") || null;
  const sortDesc = searchParams.get("desc") === "true";

  // Column visibility from URL or defaults
  const columnVisibility = useMemo(() => {
    const hiddenParam = searchParams.get("hidden");
    const hiddenSet = hiddenParam ? new Set(hiddenParam.split(",")) : null;

    const visibility: Record<string, boolean> = {};
    for (const col of columns) {
      if (col.enableHiding === false) {
        visibility[col.id] = true;
      } else if (hiddenSet) {
        visibility[col.id] = !hiddenSet.has(col.id);
      } else {
        visibility[col.id] = !col.defaultHidden;
      }
    }
    return visibility;
  }, [columns, searchParams]);

  // Filter values from URL
  const filterValues = useMemo(() => {
    const values: Record<string, string> = {};
    filters.forEach((f) => {
      values[f.id] = searchParams.get(f.id) || "all";
    });
    return values;
  }, [filters, searchParams]);

  const activeFilterCount = useMemo(
    () => Object.values(filterValues).filter((v) => v !== "all").length,
    [filterValues]
  );

  // Visible columns
  const visibleColumns = useMemo(
    () => columns.filter((col) => columnVisibility[col.id]),
    [columns, columnVisibility]
  );

  const totalPages = Math.ceil(total / pageSize);

  // URL update helper
  const updateUrl = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "" || value === "all") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!endpoint) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (search) params.set("search", search);
      if (sortBy) {
        params.set("sort", sortBy);
        if (sortDesc) params.set("desc", "true");
      }
      Object.entries(filterValues).forEach(([key, value]) => {
        if (value !== "all") params.set(key, value);
      });

      const res = await fetch(`${endpoint}?${params}`);
      const json = await res.json();
      setData(json[dataKey] || []);
      setTotal(json.total || 0);
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, [endpoint, dataKey, page, pageSize, search, sortBy, sortDesc, filterValues]);

  // Auto-fetch when URL params change (skip initial render - we have SSR data)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    fetchData();
  }, [fetchData]);

  const refresh = useCallback(() => fetchData(), [fetchData]);

  // Actions
  const setPage = useCallback(
    (p: number) => updateUrl({ page: p === 1 ? null : String(p) }),
    [updateUrl]
  );

  const setPageSize = useCallback(
    (size: number) => updateUrl({ limit: String(size), page: null }),
    [updateUrl]
  );

  const setSearch = useCallback(
    (q: string) => updateUrl({ q: q || null, page: null }),
    [updateUrl]
  );

  const setFilter = useCallback(
    (id: string, value: string) => updateUrl({ [id]: value, page: null }),
    [updateUrl]
  );

  const clearFilters = useCallback(() => {
    const updates: Record<string, null> = { page: null };
    filters.forEach((f) => (updates[f.id] = null));
    updateUrl(updates);
  }, [filters, updateUrl]);

  const setSort = useCallback(
    (column: string) => {
      if (sortBy === column) {
        updateUrl({ desc: sortDesc ? null : "true" });
      } else {
        updateUrl({ sort: column, desc: null });
      }
    },
    [sortBy, sortDesc, updateUrl]
  );

  const toggleColumn = useCallback(
    (id: string) => {
      const hidden = columns
        .filter((c) => c.enableHiding !== false)
        .filter((c) => (c.id === id ? columnVisibility[c.id] : !columnVisibility[c.id]))
        .map((c) => c.id);
      updateUrl({ hidden: hidden.length > 0 ? hidden.join(",") : null });
    },
    [columns, columnVisibility, updateUrl]
  );

  // Selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === data.length ? new Set() : new Set(data.map((r) => r.id))
    );
  }, [data]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Export
  const exportCsv = useCallback(
    (filename: string) => {
      const headers = visibleColumns.map((c) => c.header);
      const rows = data.map((row) =>
        visibleColumns.map((col) => {
          const value = getColumnValue(col, row);
          return String(value ?? "").replace(/"/g, '""');
        })
      );

      const csv = [
        headers.join(","),
        ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [data, visibleColumns]
  );

  return {
    rows: data,
    total,
    loading,
    visibleColumns,
    columnVisibility,
    toggleColumn,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    filters,
    filterValues,
    setFilter,
    clearFilters,
    activeFilterCount,
    search,
    setSearch,
    sortBy,
    sortDesc,
    setSort,
    page,
    pageSize,
    totalPages,
    setPage,
    setPageSize,
    refresh,
    exportCsv,
  };
}
