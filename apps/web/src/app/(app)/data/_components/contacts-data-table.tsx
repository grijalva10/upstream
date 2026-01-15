"use client";

import { DataTable } from "./data-table";
import { contactColumns, contactFilters, Contact } from "./columns";

interface ContactsDataTableProps {
  data: Contact[];
  total: number;
}

export function ContactsDataTable({ data, total }: ContactsDataTableProps) {
  return (
    <DataTable<Contact>
      data={data}
      columns={contactColumns}
      filters={contactFilters}
      endpoint="/api/data/contacts"
      dataKey="contacts"
      total={total}
      searchPlaceholder="Search contacts..."
      exportFilename="contacts"
    />
  );
}
