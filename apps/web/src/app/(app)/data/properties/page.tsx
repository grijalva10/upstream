import { createClient } from "@/lib/supabase/server";
import { PropertiesDataTable } from "../_components/properties-data-table";

export default async function PropertiesPage() {
  const supabase = await createClient();

  const { data, count } = await supabase
    .from("properties")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="p-6 pb-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Properties</h1>
        <p className="text-sm text-muted-foreground">
          Commercial real estate from CoStar extractions
        </p>
      </div>

      <PropertiesDataTable data={data || []} total={count || 0} />
    </div>
  );
}
