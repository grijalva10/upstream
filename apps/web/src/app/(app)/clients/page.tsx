import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CriteriaTable } from "./_components/criteria-table";
import { NewCriteriaDialog } from "./_components/new-criteria-dialog";

export default async function ClientsPage() {
  const supabase = await createClient();

  // Fetch clients with their criteria
  const { data: clients } = await supabase
    .from("clients")
    .select(
      `
      id,
      name,
      email,
      status,
      created_at
    `
    )
    .order("created_at", { ascending: false });

  // Fetch criteria for the table
  const { data: criteria } = await supabase
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">
            Manage buyers, investors, and their sourcing criteria
          </p>
        </div>
        <NewCriteriaDialog />
      </div>

      <Tabs defaultValue="criteria" className="space-y-4">
        <TabsList>
          <TabsTrigger value="criteria">Sourcing Criteria</TabsTrigger>
          <TabsTrigger value="clients">Client List</TabsTrigger>
        </TabsList>

        <TabsContent value="criteria">
          <CriteriaTable data={criteria || []} />
        </TabsContent>

        <TabsContent value="clients">
          {clients && clients.length > 0 ? (
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left text-sm font-medium">Name</th>
                    <th className="p-3 text-left text-sm font-medium">Email</th>
                    <th className="p-3 text-left text-sm font-medium">Status</th>
                    <th className="p-3 text-left text-sm font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id} className="border-b">
                      <td className="p-3 font-medium">{client.name}</td>
                      <td className="p-3 text-muted-foreground">
                        {client.email || "-"}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-green-100 text-green-700">
                          {client.status || "active"}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(client.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">No clients found</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
