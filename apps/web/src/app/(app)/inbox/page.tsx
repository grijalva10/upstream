import { createAdminClient } from "@/lib/supabase/admin";
import { PageContainer } from "@/components/layout";
import { PageSetup } from "./_components/page-setup";
import { TaskTabs, type TaskType } from "./_components/task-tabs";
import { TaskList } from "./_components/task-list";
import type { Task } from "./_components/task-item";

type TaskView = "inbox" | "future" | "archive";

interface TaskCounts {
  inbox: number;
  future: number;
  archive: number;
}

async function getTaskCounts(today: string): Promise<TaskCounts> {
  const supabase = createAdminClient();

  // Inbox: incomplete tasks due today or earlier
  const { count: inboxCount } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "snoozed"])
    .lte("due_date", today);

  // Future: incomplete tasks due after today
  const { count: futureCount } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "snoozed"])
    .gt("due_date", today);

  // Archive: completed or cancelled tasks
  const { count: archiveCount } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .in("status", ["completed", "cancelled"]);

  return {
    inbox: inboxCount ?? 0,
    future: futureCount ?? 0,
    archive: archiveCount ?? 0,
  };
}

// Map tab type to task types
function getTaskTypesForFilter(type: TaskType): string[] | null {
  switch (type) {
    case "email":
      return ["incoming_email", "email_followup"];
    case "call":
      return ["outgoing_call"];
    case "task":
      return ["lead", "deal"];
    case "all":
    default:
      return null; // No filter
  }
}

async function getTasks(
  view: TaskView,
  type: TaskType,
  today: string
): Promise<Task[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("tasks")
    .select(
      `
      id,
      type,
      title,
      description,
      subject,
      due_date,
      due_time,
      status,
      lead_id,
      contact_id,
      object_id,
      leads (name),
      contacts (email)
    `
    )
    .order("due_date", { ascending: view !== "archive" })
    .order("due_time", { ascending: true, nullsFirst: false });

  // Filter by view (time-based)
  switch (view) {
    case "inbox":
      query = query.in("status", ["pending", "snoozed"]).lte("due_date", today);
      break;
    case "future":
      query = query.in("status", ["pending", "snoozed"]).gt("due_date", today);
      break;
    case "archive":
      query = query
        .in("status", ["completed", "cancelled"])
        .order("due_date", { ascending: false })
        .limit(50);
      break;
  }

  // Filter by type (task type-based)
  const taskTypes = getTaskTypesForFilter(type);
  if (taskTypes) {
    query = query.in("type", taskTypes);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch tasks:", error);
    return [];
  }

  // Get contact IDs for incoming_email tasks to fetch drafts
  const incomingEmailTasks = data?.filter(
    (t: any) => t.type === "incoming_email" && t.contact_id
  ) || [];
  const contactIds = incomingEmailTasks.map((t: any) => t.contact_id);
  const threadIds = incomingEmailTasks
    .filter((t: any) => t.object_id)
    .map((t: any) => t.object_id);

  // Fetch pending drafts for these contacts
  let draftsMap = new Map<string, any>();
  if (contactIds.length > 0) {
    const { data: drafts } = await supabase
      .from("email_drafts")
      .select("id, subject, body, to_email, to_name, status, contact_id, source_email_id")
      .in("contact_id", contactIds)
      .eq("status", "pending");

    drafts?.forEach((d: any) => {
      // Map by contact_id - take most recent if multiple
      if (!draftsMap.has(d.contact_id)) {
        draftsMap.set(d.contact_id, d);
      }
    });
  }

  // Fetch thread context and classification for incoming_email tasks
  let threadMap = new Map<string, any[]>();
  let classificationMap = new Map<string, string>();
  let propertyMap = new Map<string, string>();

  if (threadIds.length > 0) {
    // Get emails in these threads
    const { data: threadEmails } = await supabase
      .from("synced_emails")
      .select("id, outlook_conversation_id, from_email, from_name, body_text, direction, received_at, classification, matched_lead_id")
      .in("outlook_conversation_id", threadIds)
      .order("received_at", { ascending: false })
      .limit(100);

    threadEmails?.forEach((e: any) => {
      const threadId = e.outlook_conversation_id;
      if (!threadMap.has(threadId)) {
        threadMap.set(threadId, []);
      }
      threadMap.get(threadId)!.push({
        id: e.id,
        from_email: e.from_email,
        from_name: e.from_name,
        body_text: e.body_text,
        direction: e.direction,
        received_at: e.received_at,
      });

      // Get latest inbound classification
      if (e.direction === "inbound" && e.classification && !classificationMap.has(threadId)) {
        classificationMap.set(threadId, e.classification);
      }
    });

    // Sort each thread chronologically
    threadMap.forEach((emails, threadId) => {
      emails.sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());
    });
  }

  // Fetch property addresses for leads
  const leadIds = data?.filter((t: any) => t.lead_id).map((t: any) => t.lead_id) || [];
  if (leadIds.length > 0) {
    const { data: propertyLinks } = await supabase
      .from("property_leads")
      .select("lead_id, properties (address)")
      .in("lead_id", leadIds);

    propertyLinks?.forEach((pl: any) => {
      if (pl.properties?.address && !propertyMap.has(pl.lead_id)) {
        propertyMap.set(pl.lead_id, pl.properties.address);
      }
    });
  }

  return (
    data?.map((task: any) => {
      const draft = task.contact_id ? draftsMap.get(task.contact_id) : null;
      const thread = task.object_id ? threadMap.get(task.object_id) || [] : [];
      const classification = task.object_id ? classificationMap.get(task.object_id) : null;
      const propertyAddress = task.lead_id ? propertyMap.get(task.lead_id) : null;

      return {
        id: task.id,
        type: task.type,
        title: task.title,
        description: task.description,
        subject: task.subject,
        due_date: task.due_date,
        due_time: task.due_time,
        status: task.status,
        lead_id: task.lead_id,
        lead_name: task.leads?.name ?? null,
        contact_id: task.contact_id,
        draft: draft ? {
          id: draft.id,
          subject: draft.subject,
          body: draft.body,
          to_email: draft.to_email,
          to_name: draft.to_name,
          status: draft.status,
        } : null,
        thread,
        property_address: propertyAddress,
        classification: classification ?? null,
      };
    }) ?? []
  );
}

function getEmptyMessage(view: TaskView, type: TaskType): string {
  const typeLabel =
    type === "email"
      ? "email tasks"
      : type === "call"
        ? "call tasks"
        : type === "task"
          ? "tasks"
          : "items";

  switch (view) {
    case "inbox":
      return type === "all"
        ? "No tasks due today. You're all caught up!"
        : `No ${typeLabel} due today.`;
    case "future":
      return type === "all"
        ? "No upcoming tasks scheduled."
        : `No upcoming ${typeLabel} scheduled.`;
    case "archive":
      return type === "all"
        ? "No completed tasks yet."
        : `No completed ${typeLabel} yet.`;
  }
}

interface PageProps {
  searchParams: Promise<{ view?: string; type?: string }>;
}

export default async function InboxPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const view = (params.view as TaskView) || "inbox";
  const type = (params.type as TaskType) || "all";

  // Get today's date in user's timezone (for now, use server timezone)
  const today = new Date().toISOString().split("T")[0];

  const [counts, tasks] = await Promise.all([
    getTaskCounts(today),
    getTasks(view, type, today),
  ]);

  return (
    <PageSetup counts={counts}>
      <PageContainer>
        <TaskTabs />
        <TaskList tasks={tasks} emptyMessage={getEmptyMessage(view, type)} />
      </PageContainer>
    </PageSetup>
  );
}
