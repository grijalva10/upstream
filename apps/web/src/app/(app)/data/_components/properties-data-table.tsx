"use client";

import { DataTable } from "./data-table";
import { propertyColumns, propertyFilters, Property } from "./columns";

interface PropertiesDataTableProps {
  data: Property[];
  total: number;
}

export function PropertiesDataTable({ data, total }: PropertiesDataTableProps) {
  return (
    <DataTable<Property>
      data={data}
      columns={propertyColumns}
      filters={propertyFilters}
      endpoint="/api/data/properties"
      dataKey="properties"
      total={total}
      searchPlaceholder="Search by address..."
      exportFilename="properties"
    />
  );
}
