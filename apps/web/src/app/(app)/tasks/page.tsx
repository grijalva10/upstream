import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout";
import { PageSetup } from "./_components/page-setup";
import { TaskList } from "./_components/task-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string | null;
  priority: string | null;
  due_date: string;
  due_time: string | null;
  completed_at: string | null;
  contact: { name: string }[] | null;
  company: { name: string }[] | null;
  property: { address: string }[] | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string | null;
  priority: string | null;
  due_date: string;
  due_time: string | null;
  completed_at: string | null;
  contact: { name: string } | null;
  company: { name: string } | null;
  property: { address: string } | null;
}

function transformTasks(rows: TaskRow[] | null): Task[] {
  if (!rows) return [];
  return rows.map((row) => ({
    ...row,
    contact: row.contact?.[0] ?? null,
    company: row.company?.[0] ?? null,
    property: row.property?.[0] ?? null,
  }));
}

async function getTasksData() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  // Fetch tasks with related data
  const [todayResult, upcomingResult, completedResult, overdueResult] =
    await Promise.all([
      // Today's tasks
      supabase
        .from("tasks")
        .select(
          `
          id,
          title,
          description,
          type,
          status,
          priority,
          due_date,
          due_time,
          completed_at,
          contact:contacts (name),
          company:companies (name),
          property:properties (address)
        `
        )
        .eq("due_date", today)
        .is("completed_at", null)
        .order("due_time", { ascending: true, nullsFirst: false }),

      // Upcoming tasks (next 7 days, excluding today)
      supabase
        .from("tasks")
        .select(
          `
          id,
          title,
          description,
          type,
          status,
          priority,
          due_date,
          due_time,
          completed_at,
          contact:contacts (name),
          company:companies (name),
          property:properties (address)
        `
        )
        .gt("due_date", today)
        .lte(
          "due_date",
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0]
        )
        .is("completed_at", null)
        .order("due_date")
        .order("due_time", { ascending: true, nullsFirst: false }),

      // Recently completed (last 7 days)
      supabase
        .from("tasks")
        .select(
          `
          id,
          title,
          description,
          type,
          status,
          priority,
          due_date,
          due_time,
          completed_at,
          contact:contacts (name),
          company:companies (name),
          property:properties (address)
        `
        )
        .not("completed_at", "is", null)
        .gte(
          "completed_at",
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        )
        .order("completed_at", { ascending: false }),

      // Overdue tasks
      supabase
        .from("tasks")
        .select(
          `
          id,
          title,
          description,
          type,
          status,
          priority,
          due_date,
          due_time,
          completed_at,
          contact:contacts (name),
          company:companies (name),
          property:properties (address)
        `
        )
        .lt("due_date", today)
        .is("completed_at", null)
        .order("due_date", { ascending: false }),
    ]);

  return {
    today: transformTasks(todayResult.data as TaskRow[] | null),
    upcoming: transformTasks(upcomingResult.data as TaskRow[] | null),
    completed: transformTasks(completedResult.data as TaskRow[] | null),
    overdue: transformTasks(overdueResult.data as TaskRow[] | null),
  };
}

export default async function TasksPage() {
  const data = await getTasksData();

  const todayCount = data.today.length;
  const upcomingCount = data.upcoming.length;
  const overdueCount = data.overdue.length;
  const completedCount = data.completed.length;

  return (
    <PageSetup>
      <PageContainer>
        <Tabs defaultValue="today" className="space-y-4">
          <TabsList>
            <TabsTrigger value="today" className="gap-2">
              Today
              {todayCount > 0 && (
                <Badge variant="secondary" size="sm">
                  {todayCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="gap-2">
              Upcoming
              {upcomingCount > 0 && (
                <Badge variant="secondary" size="sm">
                  {upcomingCount}
                </Badge>
              )}
            </TabsTrigger>
            {overdueCount > 0 && (
              <TabsTrigger value="overdue" className="gap-2">
                Overdue
                <Badge variant="destructive" size="sm">
                  {overdueCount}
                </Badge>
              </TabsTrigger>
            )}
            <TabsTrigger value="completed" className="gap-2">
              Completed
              {completedCount > 0 && (
                <Badge variant="outline" size="sm">
                  {completedCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today">
            <TaskList
              tasks={data.today}
              emptyTitle="No tasks for today"
              emptyDescription="You're all caught up! Check upcoming tasks or create a new one."
            />
          </TabsContent>

          <TabsContent value="upcoming">
            <TaskList
              tasks={data.upcoming}
              emptyTitle="No upcoming tasks"
              emptyDescription="Tasks scheduled for the next 7 days will appear here."
              showDate
            />
          </TabsContent>

          <TabsContent value="overdue">
            <TaskList
              tasks={data.overdue}
              emptyTitle="No overdue tasks"
              emptyDescription="Great job staying on top of your tasks!"
              showDate
              isOverdue
            />
          </TabsContent>

          <TabsContent value="completed">
            <TaskList
              tasks={data.completed}
              emptyTitle="No completed tasks"
              emptyDescription="Completed tasks from the last 7 days will appear here."
              showDate
              isCompleted
            />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </PageSetup>
  );
}
