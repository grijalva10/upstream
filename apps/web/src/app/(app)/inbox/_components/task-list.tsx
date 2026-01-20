import { TaskItem, type Task } from "./task-item";

interface TaskListProps {
  tasks: Task[];
  emptyMessage: string;
}

export function TaskList({ tasks, emptyMessage }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="border rounded-lg divide-y">
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} />
      ))}
    </div>
  );
}
