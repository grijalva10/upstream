import { createClient } from "@/lib/supabase/server";
import { CriteriaTable } from "./_components/criteria-table";
import { NewCriteriaDialog } from "./_components/new-criteria-dialog";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: criteria, error } = await supabase
    .from("client_criteria")
    .select(
      `
      id,
      name,
      criteria_json,
      status,
      total_properties,
      total_contacts,
      created_at,
      clients!inner (
        id,
        name
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error fetching criteria:", error);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Sourcing Criteria
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage buyer search criteria and run the sourcing agent
          </p>
        </div>
        <NewCriteriaDialog />
      </div>
      <CriteriaTable data={criteria || []} />
    </div>
  );
}
