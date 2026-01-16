"use client";

import { DataTable } from "./data-table";
import { exclusionColumns, exclusionFilters, Exclusion } from "./columns";

interface ExclusionsDataTableProps {
  data: Exclusion[];
  total: number;
}

export function ExclusionsDataTable({ data, total }: ExclusionsDataTableProps) {
  return (
    <DataTable<Exclusion>
      data={data}
      columns={exclusionColumns}
      filters={exclusionFilters}
      endpoint="/api/data/exclusions"
      dataKey="exclusions"
      total={total}
      searchPlaceholder="Search exclusions..."
      exportFilename="exclusions"
    />
  );
}
