"use client";

import { DataTable } from "./data-table";
import { companyColumns, companyFilters, Company } from "./columns";

interface CompaniesDataTableProps {
  data: Company[];
  total: number;
}

export function CompaniesDataTable({ data, total }: CompaniesDataTableProps) {
  return (
    <DataTable<Company>
      data={data}
      columns={companyColumns}
      filters={companyFilters}
      endpoint="/api/data/companies"
      dataKey="companies"
      total={total}
      searchPlaceholder="Search companies..."
      exportFilename="companies"
    />
  );
}
