"use client";

import { DataTable } from "@/app/(app)/data/_components/data-table";
import type { SearchWithRelations } from "../_lib/types";
import { searchColumns, searchFilters } from "./columns";

interface SearchesDataTableProps {
  data: SearchWithRelations[];
}

export function SearchesDataTable({ data }: SearchesDataTableProps) {
  return (
    <DataTable
      data={data}
      columns={searchColumns}
      filters={searchFilters}
      exportFilename="searches"
      enableSelection={false}
      enableSearch={false}
      enableColumnToggle={false}
    />
  );
}
