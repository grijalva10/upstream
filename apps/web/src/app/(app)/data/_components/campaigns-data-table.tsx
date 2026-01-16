"use client";

import { useRouter } from "next/navigation";
import { DataTable } from "./data-table";
import { campaignColumns, campaignFilters, Campaign } from "./columns";

interface CampaignsDataTableProps {
  data: Campaign[];
  total: number;
}

export function CampaignsDataTable({ data, total }: CampaignsDataTableProps) {
  const router = useRouter();

  const handleRowClick = (campaign: Campaign) => {
    router.push(`/campaigns/${campaign.id}`);
  };

  return (
    <DataTable<Campaign>
      data={data}
      columns={campaignColumns}
      filters={campaignFilters}
      endpoint="/api/data/campaigns"
      dataKey="campaigns"
      total={total}
      searchPlaceholder="Search campaigns..."
      exportFilename="campaigns"
      onRowClick={handleRowClick}
    />
  );
}
