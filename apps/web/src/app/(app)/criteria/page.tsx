import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function CriteriaPage() {
  const supabase = await createClient();

  const { data: criteria } = await supabase
    .from("client_criteria")
    .select(`
      id,
      name,
      status,
      total_properties,
      total_contacts,
      created_at,
      clients (
        name
      )
    `)
    .order("created_at", { ascending: false });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Sourcing Criteria</h1>
        <p className="text-sm text-muted-foreground">
          Buyer criteria for deal sourcing
        </p>
      </div>

      <div className="rounded-md border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left text-sm font-medium">Name</th>
              <th className="p-3 text-left text-sm font-medium">Client</th>
              <th className="p-3 text-left text-sm font-medium">Status</th>
              <th className="p-3 text-right text-sm font-medium">Properties</th>
              <th className="p-3 text-right text-sm font-medium">Contacts</th>
              <th className="p-3 text-left text-sm font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {criteria && criteria.length > 0 ? (
              criteria.map((row: any) => (
                <tr key={row.id} className="border-b hover:bg-muted/50">
                  <td className="p-3 font-medium">
                    <Link
                      href={`/criteria/${row.id}`}
                      className="hover:underline"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {row.clients?.name || "-"}
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      row.status === "active"
                        ? "bg-green-100 text-green-700"
                        : row.status === "draft"
                        ? "bg-gray-100 text-gray-700"
                        : "bg-blue-100 text-blue-700"
                    }`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">{row.total_properties || 0}</td>
                  <td className="p-3 text-right">{row.total_contacts || 0}</td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(row.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No criteria found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
