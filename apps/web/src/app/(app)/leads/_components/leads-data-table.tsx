"use client";

import { DataTable } from "@/app/(app)/data/_components/data-table";
import type { LeadWithRelations } from "../_lib/types";
import { leadColumns, leadFilters } from "./columns";

interface LeadsDataTableProps {
  data: LeadWithRelations[];
}

export function LeadsDataTable({ data }: LeadsDataTableProps) {
  return (
    <DataTable
      data={data}
      columns={leadColumns}
      filters={leadFilters}
      exportFilename="leads"
      enableSelection={false}
      enableSearch={false}
      enableColumnToggle={false}
    />
  );
}
