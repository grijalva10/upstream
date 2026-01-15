import { createClient } from "@/lib/supabase/server";
import { Send } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignCard } from "./_components/campaign-card";
import { NewCampaignDialog } from "./_components/new-campaign-dialog";
import type { CampaignWithSearch } from "./_lib/types";

async function getCampaigns(): Promise<CampaignWithSearch[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("campaigns")
    .select(`
      *,
      search:searches (id, name)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch campaigns:", error);
    return [];
  }

  return (data ?? []) as CampaignWithSearch[];
}

async function getReadySearches() {
  const supabase = await createClient();

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
  const [campaigns, readySearches] = await Promise.all([
    getCampaigns(),
    getReadySearches(),
  ]);

  const draft = campaigns.filter((c) => c.status === "draft");
  const active = campaigns.filter((c) => c.status === "active");
  const paused = campaigns.filter((c) => c.status === "paused");
  const completed = campaigns.filter((c) => c.status === "completed");

  return (
    <div className="p-4 sm:p-6 pb-8">
      <Header readySearches={readySearches} />
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="all" className="text-xs sm:text-sm">
            All ({campaigns.length})
          </TabsTrigger>
          <TabsTrigger value="draft" className="text-xs sm:text-sm">
            Draft ({draft.length})
          </TabsTrigger>
          <TabsTrigger value="active" className="text-xs sm:text-sm">
            Active ({active.length})
          </TabsTrigger>
          <TabsTrigger value="paused" className="text-xs sm:text-sm">
            Paused ({paused.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="text-xs sm:text-sm">
            Completed ({completed.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <CampaignList campaigns={campaigns} />
        </TabsContent>
        <TabsContent value="draft">
          <CampaignList campaigns={draft} empty="No draft campaigns" />
        </TabsContent>
        <TabsContent value="active">
          <CampaignList campaigns={active} empty="No active campaigns" />
        </TabsContent>
        <TabsContent value="paused">
          <CampaignList campaigns={paused} empty="No paused campaigns" />
        </TabsContent>
        <TabsContent value="completed">
          <CampaignList campaigns={completed} empty="No completed campaigns" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface HeaderProps {
  readySearches: { id: string; name: string }[];
}

function Header({ readySearches }: HeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Campaigns</h1>
        <p className="text-sm text-muted-foreground">
          Manage email outreach campaigns for your searches
        </p>
      </div>
      <NewCampaignDialog searches={readySearches} />
    </div>
  );
}

interface CampaignListProps {
  campaigns: CampaignWithSearch[];
  empty?: string;
}

function CampaignList({ campaigns, empty = "No campaigns found" }: CampaignListProps) {
  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 sm:py-12 border rounded-lg bg-muted/20 text-center">
        <Send className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/50 mb-4" aria-hidden="true" />
        <p className="text-sm sm:text-base text-muted-foreground">{empty}</p>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Create a campaign from a ready search to get started
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {campaigns.map((campaign) => (
        <CampaignCard key={campaign.id} campaign={campaign} />
      ))}
    </div>
  );
}
