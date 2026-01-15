"use client";

import { Suspense } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  SlidersHorizontal,
  Download,
  RefreshCw,
  Columns3,
  X,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Column, Filter, useDataTable, getColumnValue } from "./use-data-table";

// Re-export for convenience
export type { Column, Filter };

/** Renders sort indicator based on current sort state */
function SortIcon({ columnId, sortBy, sortDesc }: { columnId: string; sortBy: string | null; sortDesc: boolean }): React.ReactNode {
  if (sortBy !== columnId) {
    return <ChevronsUpDown className="h-4 w-4 opacity-50" />;
  }
  if (sortDesc) {
    return <ChevronDown className="h-4 w-4" />;
  }
  return <ChevronUp className="h-4 w-4" />;
}

interface DataTableProps<T extends { id: string }> {
  data: T[];
  columns: Column<T>[];
  filters?: Filter[];
  endpoint?: string;
  dataKey?: string;
  total?: number;
  searchPlaceholder?: string;
  exportFilename?: string;
  enableSelection?: boolean;
  onSelectionChange?: (ids: Set<string>) => void;
}

const PAGE_SIZES = [10, 20, 50, 100];

function DataTableInner<T extends { id: string }>({
  data,
  columns,
  filters = [],
  endpoint,
  dataKey = "data",
  total,
  searchPlaceholder = "Search...",
  exportFilename = "export",
  enableSelection = true,
}: DataTableProps<T>) {
  const table = useDataTable({
    data,
    columns,
    filters,
    endpoint,
    dataKey,
    initialTotal: total,
  });

  const showFilters = table.activeFilterCount > 0;

  return (
    <div className="space-y-4">
      {/* Toolbar - responsive layout */}
      <div className="flex flex-col gap-3">
        {/* Row 1: Search and primary actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={table.search}
              onChange={(e) => table.setSearch(e.target.value)}
              className="pl-8 h-9 w-full"
            />
          </div>

          {/* Action buttons - wrap on mobile */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Filters toggle */}
            {filters.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={table.activeFilterCount > 0 ? "secondary" : "outline"}
                    size="sm"
                    className="h-9 gap-1.5"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    <span className="hidden xs:inline">Filters</span>
                    {table.activeFilterCount > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        {table.activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {filters.map((filter) => (
                    <div key={filter.id} className="px-2 py-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        {filter.label}
                      </label>
                      <Select
                        value={table.filterValues[filter.id]}
                        onValueChange={(v) => table.setFilter(filter.id, v)}
                      >
                        <SelectTrigger className="h-8 mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {filter.options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  {table.activeFilterCount > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={table.clearFilters}
                        className="w-full justify-start text-muted-foreground"
                      >
                        <X className="h-3 w-3 mr-2" />
                        Clear filters
                      </Button>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Column visibility */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5">
                  <Columns3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Columns</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {columns
                  .filter((c) => c.enableHiding !== false)
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={table.columnVisibility[column.id]}
                      onCheckedChange={() => table.toggleColumn(column.id)}
                    >
                      {column.header}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.exportCsv(exportFilename)}
              className="h-9 gap-1.5"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>

            {/* Refresh */}
            {endpoint && (
              <Button
                variant="outline"
                size="icon"
                onClick={table.refresh}
                disabled={table.loading}
                className="h-9 w-9 flex-shrink-0"
              >
                <RefreshCw className={cn("h-4 w-4", table.loading && "animate-spin")} />
              </Button>
            )}
          </div>
        </div>

        {/* Active filters display */}
        {showFilters && (
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => {
              const value = table.filterValues[filter.id];
              if (value === "all") return null;
              const option = filter.options.find((o) => o.value === value);
              return (
                <Badge key={filter.id} variant="secondary" className="gap-1 pr-1">
                  {filter.label}: {option?.label}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 hover:bg-transparent"
                    onClick={() => table.setFilter(filter.id, "all")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              );
            })}
          </div>
        )}

        {/* Results count & selection */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{table.total.toLocaleString()} results</span>
          {enableSelection && table.selectedIds.size > 0 && (
            <Badge variant="outline">{table.selectedIds.size} selected</Badge>
          )}
        </div>
      </div>

      {/* Table - horizontal scroll on mobile */}
      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow>
              {enableSelection && (
                <TableHead className="w-10 hidden sm:table-cell">
                  <Checkbox
                    checked={table.rows.length > 0 && table.selectedIds.size === table.rows.length}
                    onCheckedChange={table.toggleSelectAll}
                  />
                </TableHead>
              )}
              {table.visibleColumns.map((column) => (
                <TableHead
                  key={column.id}
                  className={cn(
                    column.align === "center" && "text-center",
                    column.align === "right" && "text-right",
                    column.enableSorting && "cursor-pointer select-none",
                    column.className
                  )}
                  onClick={() => column.enableSorting && table.setSort(column.id)}
                >
                  <div
                    className={cn(
                      "flex items-center gap-1",
                      column.align === "center" && "justify-center",
                      column.align === "right" && "justify-end"
                    )}
                  >
                    {column.header}
                    {column.enableSorting && (
                      <span className="text-muted-foreground">
                        <SortIcon columnId={column.id} sortBy={table.sortBy} sortDesc={table.sortDesc} />
                      </span>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={(enableSelection ? 1 : 0) + table.visibleColumns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {table.loading ? "Loading..." : "No results"}
                </TableCell>
              </TableRow>
            ) : (
              table.rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(table.selectedIds.has(row.id) && "bg-muted/50")}
                >
                  {enableSelection && (
                    <TableCell className="hidden sm:table-cell">
                      <Checkbox
                        checked={table.selectedIds.has(row.id)}
                        onCheckedChange={() => table.toggleSelect(row.id)}
                      />
                    </TableCell>
                  )}
                  {table.visibleColumns.map((column) => {
                    const value = getColumnValue(column, row);
                    return (
                      <TableCell
                        key={column.id}
                        className={cn(
                          column.align === "center" && "text-center",
                          column.align === "right" && "text-right",
                          column.className
                        )}
                      >
                        {column.cell ? column.cell(value, row) : String(value ?? "-")}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination - responsive */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="hidden sm:inline">Rows per page</span>
          <span className="sm:hidden">Per page</span>
          <Select
            value={String(table.pageSize)}
            onValueChange={(v) => table.setPageSize(Number(v))}
          >
            <SelectTrigger className="w-16 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          {/* First/Last buttons hidden on mobile */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 hidden sm:inline-flex"
            onClick={() => table.setPage(1)}
            disabled={table.page === 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.setPage(table.page - 1)}
            disabled={table.page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-3 text-sm text-muted-foreground tabular-nums">
            {table.page} / {table.totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.setPage(table.page + 1)}
            disabled={table.page >= table.totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 hidden sm:inline-flex"
            onClick={() => table.setPage(table.totalPages)}
            disabled={table.page >= table.totalPages}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export function DataTable<T extends { id: string }>(props: DataTableProps<T>) {
  return (
    <Suspense fallback={<div className="h-96 flex items-center justify-center text-muted-foreground">Loading...</div>}>
      <DataTableInner {...props} />
    </Suspense>
  );
}
