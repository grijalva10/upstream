import { createAdminClient } from "@/lib/supabase/admin";
import { PageContainer } from "@/components/layout";
import { PageSetup } from "./_components/page-setup";
import { CampaignsDataTable } from "../data/_components/campaigns-data-table";
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
    .in("status", ["extracted", "campaign_active"])
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
    <PageSetup searches={readySearches} count={count}>
      <PageContainer>
        <CampaignsDataTable data={campaigns as Campaign[]} />
      </PageContainer>
    </PageSetup>
  );
}