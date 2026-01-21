import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ContactsCard } from "./_components/contacts-card";
import { PropertiesCard } from "./_components/properties-card";
import { DealsCard } from "./_components/deals-card";
import { TasksCard, type Task } from "./_components/tasks-card";
import { ActivityTimeline, type Activity } from "./_components/activity-timeline";
import { ActivityActions } from "./_components/activity-actions";
import { StatusSelect } from "./_components/status-select";
import { TypeSelect } from "./_components/type-select";

interface PageProps {
  params: Promise<{ id: string }>;
}


async function getLead(id: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("leads")
    .select(
      `
      id,
      name,
      status,
      lead_type,
      source,
      notes,
      created_at,
      updated_at
    `
    )
    .eq("id", id)
    .single();

  if (error || !data) notFound();
  return data;
}

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  status: string;
  contact_type: string | null;
}

async function getContacts(leadId: string): Promise<Contact[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("contacts")
    .select(
      `
      id,
      name,
      email,
      phone,
      title,
      status,
      contact_type
    `
    )
    .eq("lead_id", leadId)
    .order("name");

  if (error) {
    console.error("Error fetching contacts:", error);
    return [];
  }

  return data ?? [];
}

interface PropertyLoan {
  id: string;
  lender_name: string | null;
  loan_type: string | null;
  original_amount: number | null;
  current_balance: number | null;
  origination_date: string | null;
  maturity_date: string | null;
  interest_rate: number | null;
  interest_rate_type: string | null;
  ltv_current: number | null;
  dscr_current: number | null;
  payment_status: string | null;
}

interface Property {
  id: string;
  address: string | null;
  city: string | null;
  state_code: string | null;
  property_type: string | null;
  property_name: string | null;
  building_size_sqft: number | null;
  lot_size_acres: number | null;
  year_built: number | null;
  building_class: string | null;
  percent_leased: number | null;
  relationship: string;
  loans: PropertyLoan[];
}

async function getProperties(leadId: string): Promise<Property[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("property_leads")
    .select(
      `
      relationship,
      property:properties (
        id,
        address,
        city,
        state_code,
        property_type,
        property_name,
        building_size_sqft,
        lot_size_acres,
        year_built,
        building_class,
        percent_leased,
        loans:property_loans (
          id,
          lender_name,
          loan_type,
          original_amount,
          current_balance,
          origination_date,
          maturity_date,
          interest_rate,
          interest_rate_type,
          ltv_current,
          dscr_current,
          payment_status
        )
      )
    `
    )
    .eq("lead_id", leadId);

  if (error) {
    console.error("Error fetching properties:", error);
    return [];
  }

  return (
    data?.map((row: any) => ({
      ...row.property,
      relationship: row.relationship,
      loans: row.property?.loans || [],
    })) ?? []
  );
}

interface Deal {
  id: string;
  display_id: string | null;
  status: string;
  asking_price: number | null;
  noi: number | null;
  cap_rate: number | null;
  motivation: string | null;
  timeline: string | null;
  property: {
    address: string | null;
    property_type: string | null;
  } | null;
}

async function getDeals(leadId: string): Promise<Deal[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("deals")
    .select(
      `
      id,
      display_id,
      status,
      asking_price,
      noi,
      cap_rate,
      motivation,
      timeline,
      property:properties (
        address,
        property_type
      )
    `
    )
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching deals:", error);
    return [];
  }

  return (data ?? []) as Deal[];
}

async function getTasks(leadId: string): Promise<Task[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("tasks")
    .select(
      `
      id,
      type,
      title,
      due_date,
      due_time,
      status
    `
    )
    .eq("lead_id", leadId)
    .in("status", ["pending", "snoozed"])
    .order("due_date")
    .order("due_time", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("Error fetching tasks:", error);
    return [];
  }

  return (data ?? []) as Task[];
}

async function getActivities(leadId: string, contactIds: string[]): Promise<Activity[]> {
  const supabase = createAdminClient();
  const activities: Activity[] = [];

  // 1. Get completed calls (logged calls only)
  if (contactIds.length > 0) {
    const { data: calls } = await supabase
      .from("calls")
      .select(
        `
        id,
        scheduled_at,
        outcome,
        notes_md,
        contact:contacts (name)
      `
      )
      .in("contact_id", contactIds)
      .eq("status", "completed")
      .order("scheduled_at", { ascending: false });

    calls?.forEach((call: any) => {
      activities.push({
        id: `call-${call.id}`,
        type: "call",
        timestamp: call.scheduled_at,
        call_outcome: call.outcome,
        call_notes: call.notes_md,
        contact_name: call.contact?.name,
      });
    });
  }

  // 2. Get email threads (grouped by conversation_id)
  const { data: emails } = await supabase
    .from("synced_emails")
    .select(
      `
      id,
      outlook_conversation_id,
      direction,
      from_name,
      subject,
      body_text,
      received_at,
      sent_at
    `
    )
    .eq("matched_lead_id", leadId)
    .order("received_at", { ascending: false });

  if (emails && emails.length > 0) {
    // Group emails by conversation_id
    const threads = new Map<string, any[]>();
    emails.forEach((email: any) => {
      const convId = email.outlook_conversation_id || email.id;
      if (!threads.has(convId)) {
        threads.set(convId, []);
      }
      threads.get(convId)!.push(email);
    });

    threads.forEach((threadEmails, convId) => {
      // Sort emails in thread by date (oldest first for display)
      threadEmails.sort(
        (a, b) =>
          new Date(a.received_at || a.sent_at).getTime() -
          new Date(b.received_at || b.sent_at).getTime()
      );

      const latestEmail = threadEmails[threadEmails.length - 1];
      const latestTimestamp = latestEmail.received_at || latestEmail.sent_at;

      activities.push({
        id: `thread-${convId}`,
        type: "email_thread",
        timestamp: latestTimestamp,
        thread_subject: threadEmails[0].subject,
        thread_emails: threadEmails.map((e: any) => ({
          id: e.id,
          direction: e.direction,
          from_name: e.from_name,
          subject: e.subject,
          body_text: e.body_text || "",
          timestamp: e.received_at || e.sent_at,
        })),
      });
    });
  }

  // 3. Get notes from activities table
  const { data: notes } = await supabase
    .from("activities")
    .select("id, body_text, activity_at")
    .eq("lead_id", leadId)
    .eq("activity_type", "note")
    .order("activity_at", { ascending: false });

  notes?.forEach((note: any) => {
    activities.push({
      id: `note-${note.id}`,
      type: "note",
      timestamp: note.activity_at,
      note_body: note.body_text,
    });
  });

  // 4. Get deal status changes from activities table
  const { data: statusChanges } = await supabase
    .from("activities")
    .select(
      `
      id,
      activity_at,
      metadata
    `
    )
    .eq("lead_id", leadId)
    .eq("activity_type", "status_change")
    .order("activity_at", { ascending: false });

  statusChanges?.forEach((change: any) => {
    const metadata = change.metadata || {};
    activities.push({
      id: `status-${change.id}`,
      type: "deal_status_change",
      timestamp: change.activity_at,
      old_status: metadata.old_status,
      new_status: metadata.new_status,
      deal_display_id: metadata.deal_display_id,
    });
  });

  // 5. Get completed tasks
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, completed_at")
    .eq("lead_id", leadId)
    .eq("status", "completed")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false });

  tasks?.forEach((task: any) => {
    activities.push({
      id: `task-${task.id}`,
      type: "task_completed",
      timestamp: task.completed_at,
      task_title: task.title,
    });
  });

  // Sort all activities by timestamp (newest first)
  activities.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return activities;
}

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [lead, contacts, properties, deals, tasks] = await Promise.all([
    getLead(id),
    getContacts(id),
    getProperties(id),
    getDeals(id),
    getTasks(id),
  ]);

  // Fetch activities after we have contact IDs
  const contactIds = contacts.map((c) => c.id);
  const activities = await getActivities(id, contactIds);

  return (
    <div className="p-6 pb-8 space-y-6">
      {/* Back link */}
      <Link
        href="/leads"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        Leads
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{lead.name}</h1>
          <StatusSelect leadId={id} currentStatus={lead.status} />
        </div>
        <div className="flex items-center gap-4 text-sm">
          <TypeSelect leadId={id} currentType={lead.lead_type} />
          {lead.source && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">Source: {lead.source}</span>
            </>
          )}
        </div>
      </div>

      {/* Two column layout - 1/3 sidebar, 2/3 activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column - Contacts, Tasks, Properties, Deals */}
        <div className="space-y-6 lg:col-span-1">
          <ContactsCard contacts={contacts} leadId={id} />
          <TasksCard tasks={tasks} leadId={id} />
          <PropertiesCard properties={properties} />
          <DealsCard deals={deals} />
        </div>

        {/* Right column - Activity */}
        <div className="lg:col-span-2">
          <ActivityTimeline
            activities={activities}
            leadCreatedAt={lead.created_at}
            actions={
              <ActivityActions
                leadId={id}
                contacts={contacts.map((c) => ({
                  id: c.id,
                  name: c.name,
                  email: c.email,
                }))}
              />
            }
          />
        </div>
      </div>
    </div>
  );
}
