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
      leads (name)
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

  return (
    data?.map((task: any) => ({
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
    })) ?? []
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
