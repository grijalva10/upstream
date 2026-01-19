import { createAdminClient } from "@/lib/supabase/admin";
import { PageContainer } from "@/components/layout";
import { PageSetup } from "./_components/page-setup";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Lead {
  id: string;
  name: string;
  status: string;
  company_type: string | null;
  source: string | null;
  created_at: string;
  contacts: { id: string; name: string; email: string | null }[];
  property_count: number;
}

async function getLeads(): Promise<{ data: Lead[]; count: number }> {
  const supabase = createAdminClient();

  const { data, count, error } = await supabase
    .from("leads")
    .select(
      `
      id,
      name,
      status,
      company_type,
      source,
      created_at,
      contacts (id, name, email),
      property_leads (property_id)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Failed to fetch leads:", error);
    return { data: [], count: 0 };
  }

  const leads =
    data?.map((lead: any) => ({
      id: lead.id,
      name: lead.name,
      status: lead.status,
      company_type: lead.company_type,
      source: lead.source,
      created_at: lead.created_at,
      contacts: lead.contacts || [],
      property_count: lead.property_leads?.length || 0,
    })) || [];

  return { data: leads, count: count ?? 0 };
}

function getStatusColor(status: string): string {
  switch (status) {
    case "new":
      return "bg-slate-100 text-slate-800";
    case "contacted":
      return "bg-blue-100 text-blue-800";
    case "engaged":
      return "bg-amber-100 text-amber-800";
    case "qualified":
      return "bg-green-100 text-green-800";
    case "handed_off":
      return "bg-purple-100 text-purple-800";
    case "dnc":
      return "bg-red-100 text-red-800";
    case "rejected":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default async function LeadsPage() {
  const { data: leads, count } = await getLeads();

  return (
    <PageSetup>
      <PageContainer>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            {count} {count === 1 ? "lead" : "leads"} total
          </p>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contacts</TableHead>
                <TableHead>Properties</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-8"
                  >
                    No leads found
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getStatusColor(lead.status)}>
                        {lead.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.company_type || "-"}
                    </TableCell>
                    <TableCell>{lead.contacts.length}</TableCell>
                    <TableCell>{lead.property_count}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.source || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </PageContainer>
    </PageSetup>
  );
}
