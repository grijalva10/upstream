import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout";
import { PageSetup } from "./_components/page-setup";
import { PeopleList } from "./_components/people-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  DollarSign,
  Briefcase,
  Users,
  Package,
  UserCircle,
} from "lucide-react";

/**
 * Contact Types:
 * - seller: Property owner (outbound target) - is_seller=true
 * - buyer: External investor with capital - is_buyer=true
 * - broker: External broker at another firm
 * - tenant: Looking for space
 * - team: Lee & Associates (internal team)
 * - vendor: CoStar, data providers
 * - other: Catch-all
 */

interface ContactRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  status: string;
  is_buyer: boolean | null;
  is_seller: boolean | null;
  is_decision_maker: boolean | null;
  last_contacted_at: string | null;
  created_at: string | null;
  company: { id: string; name: string }[] | null;
}

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  status: string;
  is_buyer: boolean | null;
  is_seller: boolean | null;
  is_decision_maker: boolean | null;
  last_contacted_at: string | null;
  created_at: string | null;
  company: { id: string; name: string } | null;
}

function transformContacts(rows: ContactRow[] | null): Contact[] {
  if (!rows) return [];
  return rows.map((row) => ({
    ...row,
    company: row.company?.[0] ?? null,
  }));
}

async function getPeopleData() {
  const supabase = await createClient();

  // Fetch all contacts with company info
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select(
      `
      id,
      name,
      email,
      phone,
      title,
      status,
      is_buyer,
      is_seller,
      is_decision_maker,
      last_contacted_at,
      created_at,
      company:companies (id, name)
    `
    )
    .order("name");

  if (error) {
    console.error("Error fetching contacts:", error);
    return {
      all: [],
      sellers: [],
      buyers: [],
      active: [],
    };
  }

  const allContacts = transformContacts(contacts as ContactRow[] | null);

  // Categorize contacts
  const sellers = allContacts.filter((c) => c.is_seller === true);
  const buyers = allContacts.filter((c) => c.is_buyer === true);
  const active = allContacts.filter((c) => c.status === "active");

  return {
    all: allContacts,
    sellers,
    buyers,
    active,
  };
}

export default async function PeoplePage() {
  const data = await getPeopleData();

  return (
    <PageSetup>
      <PageContainer>
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all" className="gap-2">
              <Users className="h-4 w-4" />
              All
              <Badge variant="secondary" size="sm">
                {data.all.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="sellers" className="gap-2">
              <Building2 className="h-4 w-4" />
              Sellers
              {data.sellers.length > 0 && (
                <Badge variant="blue" size="sm">
                  {data.sellers.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="buyers" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Buyers
              {data.buyers.length > 0 && (
                <Badge variant="green" size="sm">
                  {data.buyers.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="active" className="gap-2">
              <UserCircle className="h-4 w-4" />
              Active
              {data.active.length > 0 && (
                <Badge variant="secondary" size="sm">
                  {data.active.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <PeopleList
              contacts={data.all}
              emptyTitle="No contacts yet"
              emptyDescription="Add your first contact to get started."
            />
          </TabsContent>

          <TabsContent value="sellers">
            <PeopleList
              contacts={data.sellers}
              emptyTitle="No sellers"
              emptyDescription="Property owners you're targeting will appear here."
            />
          </TabsContent>

          <TabsContent value="buyers">
            <PeopleList
              contacts={data.buyers}
              emptyTitle="No buyers"
              emptyDescription="Investors and buyers will appear here."
            />
          </TabsContent>

          <TabsContent value="active">
            <PeopleList
              contacts={data.active}
              emptyTitle="No active contacts"
              emptyDescription="Contacts with active status will appear here."
            />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </PageSetup>
  );
}
