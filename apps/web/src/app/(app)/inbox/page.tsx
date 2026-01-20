import { createAdminClient } from "@/lib/supabase/admin";
import { PageContainer } from "@/components/layout";
import { PageSetup } from "./_components/page-setup";
import { TaskTabs, type TaskView } from "./_components/task-tabs";
import { TaskList } from "./_components/task-list";
import type { Task } from "./_components/task-item";

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

async function getTasks(view: TaskView, today: string): Promise<Task[]> {
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

function getEmptyMessage(view: TaskView): string {
  switch (view) {
    case "inbox":
      return "No tasks due today. You're all caught up!";
    case "future":
      return "No upcoming tasks scheduled.";
    case "archive":
      return "No completed tasks yet.";
  }
}

interface PageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function InboxPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const view = (params.view as TaskView) || "inbox";

  // Get today's date in user's timezone (for now, use server timezone)
  const today = new Date().toISOString().split("T")[0];

  const [counts, tasks] = await Promise.all([
    getTaskCounts(today),
    getTasks(view, today),
  ]);

  return (
    <PageSetup>
      <PageContainer>
        <TaskTabs counts={counts} />
        <TaskList tasks={tasks} emptyMessage={getEmptyMessage(view)} />
      </PageContainer>
    </PageSetup>
  );
}
