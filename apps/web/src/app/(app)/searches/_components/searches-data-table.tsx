"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/app/(app)/data/_components/data-table";
import type { SearchWithRelations } from "../_lib/types";
import { searchColumns, searchFilters } from "./columns";

interface SearchesDataTableProps {
  data: SearchWithRelations[];
}

export function SearchesDataTable({ data }: SearchesDataTableProps) {
  const router = useRouter();

  // Check if any searches are processing (status "new" with criteria)
  const hasProcessing = data.some(
    (s) => s.status === "new" && s.criteria_json && Object.keys(s.criteria_json).length > 0
  );

  // Poll for updates when there are processing items
  useEffect(() => {
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      router.refresh();
    }, 5000);

    return () => clearInterval(interval);
  }, [hasProcessing, router]);

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
