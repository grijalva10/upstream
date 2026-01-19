"use client";

import { DataTable } from "./data-table";
import { leadColumns, leadFilters, Lead } from "./columns";

interface LeadsDataTableProps {
  data: Lead[];
  total: number;
}

export function LeadsDataTable({ data, total }: LeadsDataTableProps) {
  return (
    <DataTable<Lead>
      data={data}
      columns={leadColumns}
      filters={leadFilters}
      endpoint="/api/data/leads"
      dataKey="leads"
      total={total}
      searchPlaceholder="Search leads..."
      exportFilename="leads"
    />
  );
}
