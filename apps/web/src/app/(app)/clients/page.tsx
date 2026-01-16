import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout";
import { PageSetup } from "./_components/page-setup";

export default async function ClientsPage() {
  const supabase = await createClient();

  // Fetch clients (buyers/investors)
  const { data: clients } = await supabase
    .from("clients")
    .select(`
      id,
      name,
      email,
      status,
      created_at
    `)
    .order("created_at", { ascending: false });

  return (
    <PageSetup>
      <PageContainer>
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
                  <tr key={client.id} className="border-b hover:bg-muted/50">
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
          <div className="flex flex-col items-center justify-center py-12 border rounded-lg bg-muted/20">
            <p className="text-muted-foreground">No clients found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Clients are created when searches are run
            </p>
          </div>
        )}
      </PageContainer>
    </PageSetup>
  );
}
