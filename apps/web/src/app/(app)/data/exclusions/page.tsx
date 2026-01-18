import { createAdminClient } from "@/lib/supabase/admin";
import { ExclusionsDataTable } from "../_components/exclusions-data-table";
import { AddExclusionDialog } from "../_components/add-exclusion-dialog";

export default async function ExclusionsPage() {
  const supabase = createAdminClient();

  const { data, count } = await supabase
    .from("dnc_entries")
    .select("*", { count: "exact" })
    .order("added_at", { ascending: false })
    .limit(20);

  return (
    <div className="p-6 pb-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Do Not Contact</h1>
          <p className="text-sm text-muted-foreground">
            Emails and phones excluded from all outreach campaigns
          </p>
        </div>
        <AddExclusionDialog />
      </div>

      <ExclusionsDataTable data={data || []} total={count || 0} />
    </div>
  );
}
