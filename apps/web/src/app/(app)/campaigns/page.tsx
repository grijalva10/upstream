import { createAdminClient } from "@/lib/supabase/admin";
import { CampaignsDataTable } from "../data/_components/campaigns-data-table";
import { NewCampaignDialog } from "./_components/new-campaign-dialog";
import type { Campaign } from "../data/_components/types";

async function getCampaigns() {
  const supabase = createAdminClient();

  const { data, count } = await supabase
    .from("campaigns")
    .select("*, search:searches(id, name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(20);

  return { data: data ?? [], count: count ?? 0 };
}

async function getReadySearches() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("searches")
    .select("id, name")
    .in("status", ["ready", "campaign_created"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch ready searches:", error);
    return [];
  }

  return data ?? [];
}

export default async function CampaignsPage() {
  const [{ data: campaigns, count }, readySearches] = await Promise.all([
    getCampaigns(),
    getReadySearches(),
  ]);

  return (
    <div className="p-6 pb-8 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Email outreach campaigns for your searches
          </p>
        </div>
        <NewCampaignDialog searches={readySearches} />
      </div>

      <CampaignsDataTable data={campaigns as Campaign[]} total={count} />
    </div>
  );
}
