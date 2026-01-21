"use client";

import { DataTable } from "./data-table";
import { campaignColumns, campaignFilters, Campaign } from "./columns";

interface CampaignsDataTableProps {
  data: Campaign[];
}

export function CampaignsDataTable({ data }: CampaignsDataTableProps) {
  return (
    <DataTable
      data={data}
      columns={campaignColumns}
      filters={campaignFilters}
      exportFilename="campaigns"
      enableSelection={false}
      enableSearch={false}
      enableColumnToggle={false}
    />
  );
}