import { createAdminClient } from "@/lib/supabase/admin";
import { ContactsDataTable } from "../_components/contacts-data-table";

export default async function ContactsPage() {
  const supabase = createAdminClient();

  const { data, count } = await supabase
    .from("contacts")
    .select("*, lead:leads(id, name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="p-6 pb-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <p className="text-sm text-muted-foreground">
          All contacts across your sourcing campaigns
        </p>
      </div>

      <ContactsDataTable data={data || []} total={count || 0} />
    </div>
  );
}
